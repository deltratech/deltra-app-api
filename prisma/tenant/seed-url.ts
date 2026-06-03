export function tenantSeedUrl(schema: string) {
  const rawUrl = process.env.SEED_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/deltra';
  const url = new URL(rawUrl);

  if (!process.env.SEED_DATABASE_URL && ['postgres', 'db', 'database'].includes(url.hostname)) {
    url.hostname = 'localhost';
    url.port = process.env.DB_PORT ?? url.port ?? '5432';
  }

  url.searchParams.set('schema', schema);
  return url.toString();
}
