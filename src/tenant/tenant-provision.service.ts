import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { ConfigService } from '@nestjs/config';
import { toSchemaName } from './tenant.utils';

const execAsync = promisify(exec);

export interface MigrationResult {
  slug: string;
  schema: string;
  status: 'ok' | 'failed';
  error?: string;
}

@Injectable()
export class TenantProvisionService {
  private readonly logger = new Logger(TenantProvisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
    private readonly config: ConfigService,
  ) {}

  async provision(slug: string): Promise<void> {
    const schema = toSchemaName(slug);
    this.logger.log(`Provisioning schema: ${schema}`);

    await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS citext`);
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    const { stdout, stderr } = await execAsync(
      `npx prisma migrate deploy --schema=prisma/tenant/schema.prisma`,
      { env: { ...process.env, DATABASE_URL: this.tenantDbUrl(schema) } },
    );

    if (stdout) this.logger.log(stdout);
    if (stderr) this.logger.warn(stderr);

    this.logger.log(`Schema ${schema} provisioned`);
  }

  async deprovision(slug: string): Promise<void> {
    const schema = toSchemaName(slug);
    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    this.logger.log(`Schema ${schema} dropped`);
  }

  // ── Migration management ─────────────────────────────────────────────────────

  async migrateOne(slug: string): Promise<void> {
    const schema = toSchemaName(slug);

    // Schemas created with `db push` have no _prisma_migrations table.
    // Baseline the init migration so migrate deploy only applies newer ones.
    const tracked = await this.hasPrismaMigrationsTable(schema);
    if (!tracked) {
      this.logger.warn(`"${schema}" has no _prisma_migrations — baselining init migration`);
      await this.baselineInitMigration(schema);
    }

    const { stdout, stderr } = await execAsync(
      `npx prisma migrate deploy --schema=prisma/tenant/schema.prisma`,
      { env: { ...process.env, DATABASE_URL: this.tenantDbUrl(schema) } },
    );

    if (stdout) this.logger.log(`[${schema}] ${stdout.trim()}`);
    if (stderr) this.logger.warn(`[${schema}] ${stderr.trim()}`);
  }

  async migrateAll(): Promise<MigrationResult[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      select: { slug: true },
      orderBy: { createdAt: 'asc' },
    });

    this.logger.log(`Running migrations for ${tenants.length} tenant schemas...`);

    const settled = await Promise.allSettled(
      tenants.map((t) => this.migrateOne(t.slug)),
    );

    return settled.map((result, i) => ({
      slug: tenants[i].slug,
      schema: toSchemaName(tenants[i].slug),
      status: result.status === 'fulfilled' ? 'ok' : 'failed',
      error:
        result.status === 'rejected'
          ? String((result as PromiseRejectedResult).reason)
          : undefined,
    }));
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private tenantDbUrl(schema: string): string {
    const url = new URL(this.config.getOrThrow<string>('DATABASE_URL'));
    url.searchParams.set('schema', schema);
    return url.toString();
  }

  private async hasPrismaMigrationsTable(schema: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_name   = '_prisma_migrations'
      ) AS exists
    `;
    return rows[0]?.exists ?? false;
  }

  private async baselineInitMigration(schema: string): Promise<void> {
    // Create _prisma_migrations in the tenant schema (matches Prisma's own DDL)
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."_prisma_migrations" (
        "id"                  VARCHAR(36)  NOT NULL,
        "checksum"            VARCHAR(64)  NOT NULL,
        "finished_at"         TIMESTAMPTZ,
        "migration_name"      VARCHAR(255) NOT NULL,
        "logs"                TEXT,
        "rolled_back_at"      TIMESTAMPTZ,
        "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER      NOT NULL DEFAULT 0,
        CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
      )
    `);

    // Find the oldest (init) migration folder — it's the first alphabetically
    const migrationsDir = join(process.cwd(), 'prisma', 'tenant', 'migrations');
    const initFolder = readdirSync(migrationsDir)
      .filter((f) => !f.endsWith('.toml'))
      .sort()[0];

    if (!initFolder) {
      this.logger.warn(`No migration folders found in ${migrationsDir}`);
      return;
    }

    const sqlPath = join(migrationsDir, initFolder, 'migration.sql');
    if (!existsSync(sqlPath)) {
      this.logger.warn(`Migration SQL not found: ${sqlPath}`);
      return;
    }

    const sql = readFileSync(sqlPath, 'utf-8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const id = randomUUID();

    // Insert only if not already recorded (idempotent)
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schema}"."_prisma_migrations"
         (id, checksum, migration_name, finished_at, applied_steps_count)
       SELECT $1, $2, $3, NOW(), 1
       WHERE NOT EXISTS (
         SELECT 1 FROM "${schema}"."_prisma_migrations"
         WHERE migration_name = $3
       )`,
      id,
      checksum,
      initFolder,
    );

    this.logger.log(`Baselined "${initFolder}" in "${schema}"`);
  }
}
