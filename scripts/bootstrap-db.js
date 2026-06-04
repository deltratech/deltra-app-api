const { execFileSync } = require('node:child_process');

const TEMPLATE_SCHEMA = process.env.TENANT_TEMPLATE_SCHEMA || 'tenant_template';

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for database bootstrap');
  }
  return process.env.DATABASE_URL;
}

function validateSchemaName(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid TENANT_TEMPLATE_SCHEMA: ${schema}`);
  }
}

function withSchema(rawUrl, schema) {
  const url = new URL(rawUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input: options.input,
    env: options.env || process.env,
  });
}

function runPrisma(args, options) {
  run('npx', ['prisma', ...args], options);
}

function main() {
  const databaseUrl = requireDatabaseUrl();
  validateSchemaName(TEMPLATE_SCHEMA);

  console.log('[bootstrap-db] Applying public migrations...');
  runPrisma(['migrate', 'deploy']);

  console.log(`[bootstrap-db] Ensuring tenant template schema "${TEMPLATE_SCHEMA}"...`);
  runPrisma(['db', 'execute', '--url', withSchema(databaseUrl, 'public'), '--stdin'], {
    input: `CREATE SCHEMA IF NOT EXISTS "${TEMPLATE_SCHEMA}";\n`,
  });

  console.log(`[bootstrap-db] Applying tenant migrations to "${TEMPLATE_SCHEMA}"...`);
  runPrisma(['migrate', 'deploy', '--schema=prisma/tenant/schema.prisma'], {
    env: {
      ...process.env,
      DATABASE_URL: withSchema(databaseUrl, TEMPLATE_SCHEMA),
    },
  });

  console.log('[bootstrap-db] Database bootstrap complete.');
}

main();
