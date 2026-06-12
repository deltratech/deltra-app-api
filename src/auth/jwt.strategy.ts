import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException('Invalid token');
    if (!payload.isPlatformUser && !payload.isSuperAdmin && !payload.tenantSlug) {
      throw new UnauthorizedException('Invalid token');
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      isSuperAdmin: payload.isSuperAdmin ?? false,
      isPlatformUser: payload.isPlatformUser ?? false,
      role: payload.role,
      networkId: payload.networkId,
      impersonatorId: payload.impersonatorId,
      impersonatorRole: payload.impersonatorRole,
    };
  }
}
