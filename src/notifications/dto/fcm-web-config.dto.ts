import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FcmWebConfigDto {
  @ApiProperty()
  apiKey: string;

  @ApiProperty()
  authDomain: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  storageBucket: string;

  @ApiProperty()
  messagingSenderId: string;

  @ApiProperty()
  appId: string;

  @ApiPropertyOptional()
  measurementId?: string;

  @ApiPropertyOptional({ description: 'Firebase Web Push certificate public key used as getToken vapidKey' })
  vapidKey?: string;
}
