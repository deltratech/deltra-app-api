import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL!;

async function provision(slug: string) {
  const prisma = new PrismaClient();
  const schema = `tenant_${slug}`;

  console.log(`\n[0] Ensuring extensions exist (database-wide)`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS citext`);

  console.log(`[1] Creating schema: ${schema}`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

  console.log(`[2] Running migrations for: ${schema}`);
  const url = new URL(DATABASE_URL);
  // Use options instead of schema= so search_path includes public,
  // which makes citext and pgcrypto (installed in public) visible.
  url.searchParams.delete('schema');
  url.searchParams.set('options', `-c search_path=${schema},public`);

  execSync(`npx prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'inherit',
  });

  console.log(`\n[3] Verifying tables in schema "${schema}":`);
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`,
    schema,
  );
  tables.forEach((t) => console.log(`   ✓ ${schema}.${t.tablename}`));

  await prisma.$disconnect();
}

provision('sma-pelita').catch(console.error);
