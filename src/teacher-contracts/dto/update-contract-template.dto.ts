import { PartialType } from '@nestjs/swagger';
import { CreateContractTemplateDto } from './create-contract-template.dto';

export class UpdateContractTemplateDto extends PartialType(CreateContractTemplateDto) {}
