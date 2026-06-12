import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { getTenantContext } from '../tenant/tenant.context';

const DEFAULT_LETTER = `Kepada Yth. Orang Tua/Wali dari {applicantName},

Dengan hormat,

Berdasarkan hasil seleksi Penerimaan Peserta Didik Baru tahun ajaran {academicYear}, kami dengan senang hati menyampaikan bahwa:

Nama Calon Siswa : {applicantName}
Nomor Pendaftaran : {applicationNo}
Jenjang / Kelas : {gradeLabel}

dinyatakan DITERIMA sebagai peserta didik di {schoolName}.

Mohon untuk menyelesaikan proses administrasi dan pembayaran sesuai ketentuan yang berlaku. Informasi lebih lanjut dapat dilihat melalui halaman pelacakan pendaftaran Anda.

Atas perhatian dan kepercayaan Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,
Panitia PPDB
{schoolName}`;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Injectable()
export class LettersService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private get apps() { return this.tenantPrisma.client.admissionApplication; }
  private get forms() { return this.tenantPrisma.client.ppdbForm; }

  private async fetchTenant() {
    const { tenantId } = getTenantContext();
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, include: { settings: true } });
    return { name: t?.name ?? 'Sekolah', address: t?.settings?.address ?? null, phone: t?.settings?.phone ?? null };
  }

  private buildHtml(
    app: { applicantName: string; applicationNo: string | null; gradeLabel: string; schoolLevel: string; academicYear: string; guardianName: string | null },
    body: string,
    tenant: { name: string; address: string | null; phone: string | null },
  ) {
    const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const vars: Record<string, string> = {
      applicantName: app.applicantName,
      applicationNo: app.applicationNo ?? '-',
      gradeLabel: app.gradeLabel,
      schoolLevel: app.schoolLevel,
      academicYear: app.academicYear,
      guardianName: app.guardianName ?? '-',
      schoolName: tenant.name,
      date,
    };
    let content = esc(body);
    for (const [k, v] of Object.entries(vars)) content = content.split(`{${k}}`).join(esc(v));
    content = content.replace(/\n/g, '<br>');
    const addrLine = [tenant.address, tenant.phone].filter(Boolean).map(esc).join(' &middot; ');

    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 28mm 22mm; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 12pt; line-height: 1.6; }
      .head { text-align: center; border-bottom: 3px solid #1ecfad; padding-bottom: 12px; margin-bottom: 8px; }
      .school { font-size: 18pt; font-weight: 800; letter-spacing: .3px; }
      .addr { font-size: 9.5pt; color: #64748b; margin-top: 2px; }
      .date { text-align: right; color: #475569; font-size: 10.5pt; margin: 18px 0; }
      .body { white-space: normal; }
    </style></head><body>
      <div class="head"><div class="school">${esc(tenant.name)}</div>${addrLine ? `<div class="addr">${addrLine}</div>` : ''}</div>
      <div class="date">${esc(date)}</div>
      <div class="body">${content}</div>
    </body></html>`;
  }

  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const url = process.env.GOTENBERG_URL ?? 'http://gotenberg:3000';
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    const res = await fetch(`${url}/forms/chromium/convert/html`, { method: 'POST', body: form });
    if (!res.ok) throw new BadRequestException(`Failed to render letter (status ${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async loadAppAndBody(id: string) {
    const app = await this.apps.findFirst({ where: { id, deletedAt: null } });
    if (!app) throw new NotFoundException(`Application ${id} not found`);
    const form = await this.forms.findFirst({ where: { academicYear: app.academicYear, deletedAt: null } });
    const body = form?.acceptanceLetter?.trim() || DEFAULT_LETTER;
    return { app, body };
  }

  /** Render the letter PDF without saving (admin preview). */
  async previewLetter(id: string): Promise<Buffer> {
    const { app, body } = await this.loadAppAndBody(id);
    const tenant = await this.fetchTenant();
    return this.renderHtmlToPdf(this.buildHtml(app as any, body, tenant));
  }

  /** Render, store, and mark the letter as issued. */
  async issueLetter(id: string) {
    const { app, body } = await this.loadAppAndBody(id);
    const tenant = await this.fetchTenant();
    const pdf = await this.renderHtmlToPdf(this.buildHtml(app as any, body, tenant));
    const slug = getTenantContext().tenantSlug ?? 'shared';
    const fileName = `acceptance-${app.applicationNo ?? app.id}.pdf`;
    const url = await this.storage.upload(pdf, fileName, 'application/pdf', 'admission-letters', slug, fileName);
    const updated = await this.apps.update({
      where: { id },
      data: { letterUrl: url, letterIssuedAt: new Date() },
    });
    return { id: updated.id, letterUrl: updated.letterUrl, letterIssuedAt: updated.letterIssuedAt };
  }

  async bulkIssue(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('ids are required');
    let issued = 0;
    for (const id of ids) { try { await this.issueLetter(id); issued++; } catch { /* skip failures */ } }
    return { issued };
  }
}
