import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_API_KEY } from '../decorators/require-api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireApiKey = this.reflector.getAllAndOverride<boolean>(REQUIRE_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic && !requireApiKey) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-api-key'];
    const expected = this.config.getOrThrow<string>('API_KEY');

    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
