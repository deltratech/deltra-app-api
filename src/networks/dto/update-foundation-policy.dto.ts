import { PartialType } from '@nestjs/swagger';
import { CreateFoundationPolicyDto } from './create-foundation-policy.dto';

export class UpdateFoundationPolicyDto extends PartialType(CreateFoundationPolicyDto) {}
