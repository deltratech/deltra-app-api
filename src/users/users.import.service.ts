import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { UserRole } from '../common/enums/user-role.enum';

interface ImportRow {
  email: string;
  fullName: string;
  phone?: string;
  password?: string;
  role: UserRole;
}

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: { row: number; email: string; reason: string }[];
}

const ALLOWED_ROLES = Object.values(UserRole) as string[];

// Expected column headers (case-insensitive)
const COL = {
  email:    ['email'],
  fullName: ['full_name', 'fullname', 'nama', 'name'],
  phone:    ['phone', 'telepon', 'no_hp', 'no_telp'],
  password: ['password', 'kata_sandi'],
  role:     ['role', 'peran'],
};

@Injectable()
export class UsersImportService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async importFromFile(
    buffer: Buffer,
    mimetype: string,
    filterRole?: UserRole,
  ): Promise<ImportResult> {
    const rows = mimetype.includes('spreadsheet') || mimetype.includes('excel')
      ? await this.parseExcel(buffer)
      : this.parseCsv(buffer);

    const filtered = filterRole ? rows.filter(r => r.role === filterRole) : rows;
    return this.persistRows(filtered);
  }

  // ── Parsers ──────────────────────────────────────────────────────────────────

  private async parseExcel(buffer: Buffer): Promise<ImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel file has no worksheets');

    const headers = this.extractHeaders(
      sheet.getRow(1).values as (string | undefined)[],
    );
    const rows: ImportRow[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as (string | undefined)[];
      const mapped = this.mapRow(headers, values);
      if (mapped) rows.push(mapped);
    });

    return rows;
  }

  private parseCsv(buffer: Buffer): ImportRow[] {
    const records: string[][] = parse(buffer, {
      skip_empty_lines: true,
      trim: true,
    });
    if (records.length < 2) return [];

    const headers = this.extractHeaders(records[0]);
    return records
      .slice(1)
      .map(values => this.mapRow(headers, values))
      .filter((r): r is ImportRow => r !== null);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private extractHeaders(rawHeaders: (string | undefined)[]): Record<string, number> {
    const map: Record<string, number> = {};
    rawHeaders.forEach((h, i) => {
      if (!h) return;
      const lower = h.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(COL)) {
        if (aliases.includes(lower)) map[field] = i;
      }
    });
    return map;
  }

  private mapRow(
    headers: Record<string, number>,
    values: (string | undefined)[],
  ): ImportRow | null {
    const get = (field: string) => {
      const idx = headers[field];
      return idx !== undefined ? (values[idx] ?? '').toString().trim() : '';
    };

    const email    = get('email');
    const fullName = get('fullName');
    const role     = get('role').toLowerCase();

    if (!email || !fullName || !ALLOWED_ROLES.includes(role)) return null;

    return {
      email,
      fullName,
      phone:    get('phone')    || undefined,
      password: get('password') || undefined,
      role:     role as UserRole,
    };
  }

  private async persistRows(rows: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    const db = this.tenantPrisma.client;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const exists = await db.user.findUnique({ where: { email: row.email } });
        if (exists) {
          result.skipped++;
          continue;
        }

        const passwordHash = row.password
          ? await bcrypt.hash(row.password, 12)
          : await bcrypt.hash(this.tempPassword(), 10);

        await db.user.create({
          data: {
            email:        row.email,
            fullName:     row.fullName,
            phone:        row.phone ?? null,
            passwordHash,
            role:         row.role,
          },
        });
        result.created++;
      } catch (err) {
        result.errors.push({
          row:    i + 2, // +2: 1-indexed + header row
          email:  row.email,
          reason: (err as Error).message,
        });
      }
    }

    return result;
  }

  // Random 12-char temp password — user should reset via forgot-password flow
  private tempPassword(): string {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
  }
}
