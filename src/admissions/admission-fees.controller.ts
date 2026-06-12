import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeesService } from './fees.service';
import { InvoicesService } from './invoices.service';
import { PpdbService } from './ppdb.service';
import {
  CreateDevFeeTierDto, CreateFeeScheduleDto, UpdateDevFeeTierDto, UpdateFeeScheduleDto,
} from './dto/fee.dto';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/invoice.dto';
import { CreatePpdbFormDto, UpdatePpdbFormDto } from './dto/ppdb.dto';
import { AdmissionSchoolLevel } from './admissions.enums';

@ApiTags('Admissions — Fees & Invoices')
@ApiBearerAuth()
@Controller('admissions')
export class AdmissionFeesController {
  constructor(
    private readonly fees: FeesService,
    private readonly invoices: InvoicesService,
    private readonly ppdb: PpdbService,
  ) {}

  // ── Export ─────────────────────────────────────────────────────────────────
  @Get('fees/export')
  @ApiOperation({ summary: 'Export configured fees + packages as an .xlsx file' })
  @ApiQuery({ name: 'academicYear', required: false })
  async exportFees(
    @Res({ passthrough: true }) res: Response,
    @Query('academicYear') academicYear?: string,
  ) {
    const buf = await this.fees.exportWorkbook(academicYear);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ppdb-fees-${academicYear ?? 'all'}.xlsx"`,
    });
    return new StreamableFile(buf);
  }

  // ── Public registration form ─────────────────────────────────────────────
  @Get('ppdb-form')
  @ApiOperation({ summary: 'Get the public PPDB form for an academic year (or null)' })
  @ApiQuery({ name: 'academicYear', required: true })
  getForm(@Query('academicYear') academicYear: string) {
    return this.ppdb.getForm(academicYear);
  }

  @Post('ppdb-form')
  @ApiOperation({ summary: 'Create (or return existing) public PPDB form for a year' })
  createForm(@Body() dto: CreatePpdbFormDto) {
    return this.ppdb.createForm(dto);
  }

  @Patch('ppdb-form/:id')
  @ApiOperation({ summary: 'Open/close or rename the public PPDB form' })
  updateForm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePpdbFormDto) {
    return this.ppdb.updateForm(id, dto);
  }

  // ── Fee schedules ────────────────────────────────────────────────────────
  @Get('fee-schedules')
  @ApiOperation({ summary: 'List fee schedules' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'schoolLevel', enum: AdmissionSchoolLevel, required: false })
  listFeeSchedules(
    @Query('academicYear') academicYear?: string,
    @Query('schoolLevel') schoolLevel?: AdmissionSchoolLevel,
  ) {
    return this.fees.listFeeSchedules({ academicYear, schoolLevel });
  }

  @Post('fee-schedules')
  @ApiOperation({ summary: 'Create a fee schedule' })
  createFeeSchedule(@Body() dto: CreateFeeScheduleDto) {
    return this.fees.createFeeSchedule(dto);
  }

  @Patch('fee-schedules/:id')
  @ApiOperation({ summary: 'Update a fee schedule' })
  updateFeeSchedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeeScheduleDto) {
    return this.fees.updateFeeSchedule(id, dto);
  }

  @Delete('fee-schedules/:id')
  @ApiOperation({ summary: 'Delete a fee schedule' })
  removeFeeSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.fees.removeFeeSchedule(id);
  }

  // ── Development-fee tiers ────────────────────────────────────────────────
  @Get('dev-fee-tiers')
  @ApiOperation({ summary: 'List development-fee tiers' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'schoolLevel', enum: AdmissionSchoolLevel, required: false })
  listDevTiers(
    @Query('academicYear') academicYear?: string,
    @Query('schoolLevel') schoolLevel?: AdmissionSchoolLevel,
  ) {
    return this.fees.listDevTiers({ academicYear, schoolLevel });
  }

  @Post('dev-fee-tiers')
  @ApiOperation({ summary: 'Create a development-fee tier' })
  createDevTier(@Body() dto: CreateDevFeeTierDto) {
    return this.fees.createDevTier(dto);
  }

  @Patch('dev-fee-tiers/:id')
  @ApiOperation({ summary: 'Update a development-fee tier' })
  updateDevTier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDevFeeTierDto) {
    return this.fees.updateDevTier(id, dto);
  }

  @Delete('dev-fee-tiers/:id')
  @ApiOperation({ summary: 'Delete a development-fee tier' })
  removeDevTier(@Param('id', ParseUUIDPipe) id: string) {
    return this.fees.removeDevTier(id);
  }

  // ── Applicable fees + invoices ───────────────────────────────────────────
  @Get('applications/:id/applicable-fees')
  @ApiOperation({ summary: 'Fees + dev-fee tiers applicable to an application' })
  applicableFees(@Param('id', ParseUUIDPipe) id: string) {
    return this.fees.applicableFor(id);
  }

  @Get('applications/:id/invoices')
  @ApiOperation({ summary: 'List invoices for an application' })
  listInvoices(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.listByApplication(id);
  }

  @Post('applications/:id/invoices')
  @ApiOperation({ summary: 'Generate an invoice for an application' })
  createInvoice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(id, dto);
  }

  @Patch('invoices/:invoiceId/payment')
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  recordPayment(@Param('invoiceId', ParseUUIDPipe) invoiceId: string, @Body() dto: RecordPaymentDto) {
    return this.invoices.recordPayment(invoiceId, dto);
  }

  @Patch('invoices/:invoiceId/cancel')
  @ApiOperation({ summary: 'Cancel an invoice' })
  cancelInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.invoices.cancel(invoiceId);
  }

  @Delete('invoices/:invoiceId')
  @ApiOperation({ summary: 'Soft-delete an invoice' })
  removeInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.invoices.remove(invoiceId);
  }
}
