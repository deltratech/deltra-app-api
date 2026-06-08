import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { tenantStorage } from './tenant.context';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const slug = this.resolveSlug(req);
    if (!slug) return next(); // public routes (health, auth/login, docs)

    const [tenant] = await this.prisma.$queryRaw<
      Array<{ id: string; slug: string; status: 'active' | 'inactive' | 'suspended' }>
    >`
      SELECT id, slug, status::text AS status
      FROM public.tenants
      WHERE slug = ${slug} AND deleted_at IS NULL
      LIMIT 1
    `;

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

    // 3. Subdomain: sma-pelita.deltra.id -> "sma-pelita"
    const host = req.hostname.toLowerCase();
    if (this.isReservedHost(host)) return null;

    const parts = host.split('.');
    const subdomain = parts[0];
    if (parts.length >= 3 && !this.reservedSubdomains().has(subdomain)) return subdomain;

    return null;
  }

  private isReservedHost(host: string): boolean {
    return this.configuredHosts().has(host);
  }

  private configuredHosts(): Set<string> {
    return new Set(
      [
        this.config.get<string>('APP_HOST'),
        this.config.get<string>('API_HOST'),
        this.config.get<string>('FRONTEND_HOST'),
      ]
        .flatMap((value) => this.splitConfigList(value))
        .map((value) => this.normalizeHost(value)),
    );
  }

  private reservedSubdomains(): Set<string> {
    return new Set(
      ['app', ...this.splitConfigList(this.config.get<string>('RESERVED_SUBDOMAINS'))].map(
        (value) => value.toLowerCase(),
      ),
    );
  }

  private normalizeHost(value: string): string {
    return value.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
  }

  private splitConfigList(value?: string): string[] {
    return value
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  }
}
