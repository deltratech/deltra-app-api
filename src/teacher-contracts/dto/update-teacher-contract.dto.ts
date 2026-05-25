import { PartialType } from '@nestjs/swagger';
import { CreateTeacherContractDto } from './create-teacher-contract.dto';

export class UpdateTeacherContractDto extends PartialType(CreateTeacherContractDto) {}
