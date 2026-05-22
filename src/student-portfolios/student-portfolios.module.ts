import { Module } from '@nestjs/common';
import { StudentPortfoliosController } from './student-portfolios.controller';
import { StudentPortfoliosService } from './student-portfolios.service';

@Module({
  controllers: [StudentPortfoliosController],
  providers: [StudentPortfoliosService],
  exports: [StudentPortfoliosService],
})
export class StudentPortfoliosModule {}
