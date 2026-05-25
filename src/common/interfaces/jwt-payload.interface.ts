export interface JwtPayload {
  sub: string;          // userId
  tenantId?: string;
  tenantSlug?: string;
  isSuperAdmin?: boolean;
}
