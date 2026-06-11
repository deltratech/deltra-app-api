import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/invoice.dto';
import { AdmissionInvoiceStatus } from './admissions.enums';

@Injectable()
export class InvoicesService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  private get invoices() { return this.tenantPrisma.client.admissionInvoice; }

  listByApplication(applicationId: string) {
    return this.invoices.findMany({
      where: { applicationId, deletedAt: null },
      include: { items: true },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async create(applicationId: string, dto: CreateInvoiceDto) {
    const app = await this.tenantPrisma.client.admissionApplication.findFirst({
      where: { id: applicationId, deletedAt: null },
    });
    if (!app) throw new NotFoundException(`Application ${applicationId} not found`);

    const total = dto.items.reduce((sum, i) => sum + i.amount, 0);
    const seq = await this.invoices.count({ where: { application: { academicYear: app.academicYear } } });
    const invoiceNo = `INV-${app.academicYear.split('-')[0]}-${String(seq + 1).padStart(4, '0')}`;

    return this.invoices.create({
      data: {
        applicationId,
        invoiceNo,
        status: AdmissionInvoiceStatus.sent,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        totalAmount: total,
        notes: dto.notes,
        items: {
          create: dto.items.map((i) => ({
            description: i.description,
            amount: i.amount,
            periodLabel: i.periodLabel,
            feeScheduleId: i.feeScheduleId,
            devFeeTierId: i.devFeeTierId,
          })),
        },
      },
      include: { items: true },
    });
  }

  async recordPayment(invoiceId: string, dto: RecordPaymentDto) {
    const invoice = await this.findOne(invoiceId);
    if (invoice.status === AdmissionInvoiceStatus.cancelled) {
      throw new BadRequestException('Cannot pay a cancelled invoice');
    }
    const paidAmount = dto.amount != null
      ? Math.min(invoice.totalAmount, invoice.paidAmount + dto.amount)
      : invoice.totalAmount;
    const fullyPaid = paidAmount >= invoice.totalAmount;

    return this.invoices.update({
      where: { id: invoiceId },
      data: {
        paidAmount,
        status: fullyPaid ? AdmissionInvoiceStatus.paid : AdmissionInvoiceStatus.sent,
        paidAt: fullyPaid ? new Date() : null,
      },
      include: { items: true },
    });
  }

  async cancel(invoiceId: string) {
    await this.findOne(invoiceId);
    return this.invoices.update({
      where: { id: invoiceId },
      data: { status: AdmissionInvoiceStatus.cancelled },
      include: { items: true },
    });
  }

  async remove(invoiceId: string) {
    await this.findOne(invoiceId);
    await this.invoices.update({ where: { id: invoiceId }, data: { deletedAt: new Date() } });
    return { id: invoiceId, deleted: true };
  }

  private async findOne(id: string) {
    const invoice = await this.invoices.findFirst({ where: { id, deletedAt: null } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }
}
