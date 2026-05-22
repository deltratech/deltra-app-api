import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient as TenantPrismaClient } from '../generated/tenant-client/index.js';
import { getTenantContext } from '../tenant/tenant.context';
import { toSchemaName } from '../tenant/tenant.utils';

function loadTenantPrismaClient(): { PrismaClient: typeof TenantPrismaClient } {
  const candidates = [
    join(__dirname, '../generated/tenant-client/index.js'),
    join(__dirname, '../../generated/tenant-client/index.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return require(candidate) as { PrismaClient: typeof TenantPrismaClient };
    }
  }

  throw new Error(
    `Tenant Prisma client not found. Checked: ${candidates.join(', ')}`,
  );
}

const { PrismaClient } = loadTenantPrismaClient();

const MAX_CLIENTS = 50;

@Injectable()
export class PrismaTenantService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaTenantService.name);
  private clients = new Map<string, TenantPrismaClient>();
  private lastAccess = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  /** Returns a PrismaClient scoped to the current request's tenant schema. */
  get client(): TenantPrismaClient {
    const { tenantSlug } = getTenantContext();
    return this.forSchema(toSchemaName(tenantSlug));
  }

  /** Returns a PrismaClient for an explicit schema name (used during provisioning). */
  forSchema(schema: string): TenantPrismaClient {
    if (this.clients.has(schema)) {
      this.lastAccess.set(schema, Date.now());
      return this.clients.get(schema)!;
    }

    if (this.clients.size >= MAX_CLIENTS) {
      this.evictLru();
    }

    const base = this.config.getOrThrow<string>('DATABASE_URL');
    const url = new URL(base);
    url.searchParams.set('schema', schema);

    const client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    this.clients.set(schema, client);
    this.lastAccess.set(schema, Date.now());
    return client;
  }

  private evictLru(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, time] of this.lastAccess) {
      if (time < lruTime) {
        lruTime = time;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.clients.get(lruKey)!.$disconnect().catch((err: unknown) => {
        this.logger.warn(`Failed to disconnect evicted client for "${lruKey}": ${err}`);
      });
      this.clients.delete(lruKey);
      this.lastAccess.delete(lruKey);
      this.logger.debug(`LRU evicted tenant client for schema: ${lruKey}`);
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.clients.values()].map((c) => c.$disconnect()));
    this.clients.clear();
    this.lastAccess.clear();
  }
}
