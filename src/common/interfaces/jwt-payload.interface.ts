export interface JwtPayload {
  sub: string;          // userId
  tenantId?: string;
  tenantSlug?: string;
  isSuperAdmin?: boolean;
  isPlatformUser?: boolean;
  role?: string;
  networkId?: string;
  impersonatorId?: string;    // platform user acting as this (impersonated) user
  impersonatorRole?: string;  // their platform role (network_admin / superadmin)
}
