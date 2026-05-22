export function toSchemaName(slug: string): string {
  return `tenant_${slug.replace(/-/g, '_')}`;
}
