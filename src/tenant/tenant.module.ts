import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { TenantProvisionService } from './tenant-provision.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [PrismaTenantService, TenantProvisionService],
  exports: [PrismaTenantService, TenantProvisionService, JwtModule],
})
export class TenantModule {}
