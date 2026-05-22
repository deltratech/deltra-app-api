import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { tenantStorage } from './tenant.context';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const slug = this.resolveSlug(req);
    if (!slug) return next(); // public routes (health, auth/login, docs)

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, deletedAt: null },
      select: { id: true, slug: true, status: true },
    });

    if (!tenant) throw new NotFoundException(`Tenant '${slug}' not found`);
    if (tenant.status === 'suspended')
      throw new ForbiddenException(`Tenant '${slug}' is suspended`);

    tenantStorage.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, next);
  }

  private resolveSlug(req: Request): string | null {
    // 1. Explicit header (Postman / mobile apps)
    const header = req.headers['x-tenant-slug'] as string;
    if (header) return header;

    // 2. JWT Bearer token — extract tenantSlug from payload
    const auth = req.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      try {
        const token = auth.slice(7);
        const payload = this.jwt.decode(token) as JwtPayload;
        if (payload?.tenantSlug) return payload.tenantSlug;
      } catch {
        // invalid token — let JwtAuthGuard handle the error
      }
    }

    // 3. Subdomain: sma-pelita.deltra.id → "sma-pelita"
    const host = req.hostname;
    const parts = host.split('.');
    if (parts.length >= 3) return parts[0];

    return null;
  }
}
