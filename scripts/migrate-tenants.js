#!/usr/bin/env node
/**
 * Apply all pending TENANT migrations to every tenant schema in the database.
 *
 * Schema-per-tenant workflow:
 *   1. Edit prisma/tenant/schema.prisma and create a migration (prisma migrate dev
 *      against tenant_template, or hand-write a migration.sql).
 *   2. Run this to fan the migration out to every existing tenant:
 *        DATABASE_URL="postgresql://USER:PASS@HOST:5432/deltra?schema=public" \
 *          node scripts/migrate-tenants.js
 *      (or: npm run migrate:tenants)
 *
 * Why not POST /tenants/migrate-all? That endpoint runs every tenant CONCURRENTLY,
 * and concurrent `prisma migrate deploy` runs contend on Postgres advisory locks
 * and flake. This script runs them SERIALLY with per-tenant pass/fail reporting.
 *
 * Flags (env):
 *   INCLUDE_TEMPLATE=true   also migrate tenant_template (default: skip — you
 *                           develop on it, so it's already ahead)
 *   ONLY=tenant_a,tenant_b  restrict to a comma-separated list of schemas
 */
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    console.error('ERROR: DATABASE_URL is required (point it at ?schema=public).');
    process.exit(1);
  }

  // Discover tenant schemas straight from the database.
  const prisma = new PrismaClient();
  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name`,
    );
  } finally {
    await prisma.$disconnect();
  }

  const includeTemplate = process.env.INCLUDE_TEMPLATE === 'true';
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map((s) => s.trim())) : null;

  let schemas = rows.map((r) => r.schema_name);
  if (!includeTemplate) schemas = schemas.filter((s) => s !== 'tenant_template');
  if (only) schemas = schemas.filter((s) => only.has(s));

  if (schemas.length === 0) {
    console.log('No tenant schemas to migrate.');
    return;
  }

  console.log(`Applying tenant migrations to ${schemas.length} schema(s):`);
  console.log(`  ${schemas.join(', ')}\n`);

  const results = [];
  for (const schema of schemas) {
    const url = new URL(baseUrl);
    url.searchParams.set('schema', schema);
    process.stdout.write(`→ ${schema} ... `);
    try {
      const out = execSync('npx prisma migrate deploy --schema=prisma/tenant/schema.prisma', {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'pipe',
      }).toString();
      const applied = (out.match(/Applying migration/g) || []).length;
      console.log(applied > 0 ? `OK (${applied} applied)` : 'OK (up to date)');
      results.push({ schema, ok: true });
    } catch (err) {
      console.log('FAILED');
      console.error((err.stdout?.toString() || '') + (err.stderr?.toString() || err.message));
      results.push({ schema, ok: false });
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} schema(s) succeeded.`);
  if (failed.length) {
    console.error(`Failed: ${failed.map((f) => f.schema).join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
