import { Module } from '@nestjs/common';
import { AdmissionsController } from './admissions.controller';
import { AdmissionFeesController } from './admission-fees.controller';
import { PublicPpdbController } from './public-ppdb.controller';
import { AdmissionsService } from './admissions.service';
import { FeesService } from './fees.service';
import { InvoicesService } from './invoices.service';
import { PpdbService } from './ppdb.service';
import { LettersService } from './letters.service';

@Module({
  controllers: [AdmissionsController, AdmissionFeesController, PublicPpdbController],
  providers: [AdmissionsService, FeesService, InvoicesService, PpdbService, LettersService],
  exports: [AdmissionsService, FeesService, InvoicesService, PpdbService, LettersService],
})
export class AdmissionsModule {}
