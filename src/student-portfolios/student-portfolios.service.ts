import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfolioType } from '../common/enums/portfolio-type.enum';
import { paginatedResult } from '../common/utils/paginate';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class StudentPortfoliosService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  async findAll(filters: {
    studentProfileId?: string;
    type?: PortfolioType;
    year?: number;
    classroomId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { studentProfileId, type, year, classroomId, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...(studentProfileId ? { studentProfileId } : {}),
      ...(type ? { type } : {}),
      ...(year ? { startDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } : {}),
      ...(classroomId ? { studentProfile: { enrollments: { some: { classroomId, status: 'active' as const } } } } : {}),
      ...(search ? {
        OR: [
          { title:       { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const include = {
      attachments: true,
      subject: { select: { id: true, code: true, name: true } },
      studentProfile: {
        select: { id: true, user: { select: { id: true, fullName: true, avatarUrl: true } } },
      },
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.studentPortfolio.findMany({
        where, include, skip, take: limit,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.tenantPrisma.client.studentPortfolio.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const portfolio = await this.tenantPrisma.client.studentPortfolio.findUnique({
      where: { id },
      include: {
        attachments: true,
        subject: { select: { id: true, code: true, name: true } },
        studentProfile: {
          select: {
            id: true,
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!portfolio) throw new NotFoundException(`Portfolio ${id} not found`);
    return portfolio;
  }

  async create(dto: CreatePortfolioDto) {
    return this.tenantPrisma.client.studentPortfolio.create({
      data: {
        studentProfileId: dto.studentProfileId,
        title:            dto.title,
        type:             dto.type,
        description:      dto.description,
        subjectId:        dto.subjectId,
        startDate:        dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:          dto.endDate   ? new Date(dto.endDate)   : undefined,
      },
      include: {
        attachments: true,
        subject: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdatePortfolioDto) {
    await this.findOne(id);
    return this.tenantPrisma.client.studentPortfolio.update({
      where: { id },
      data: {
        title:       dto.title,
        type:        dto.type,
        description: dto.description,
        subjectId:   dto.subjectId,
        startDate:   dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:     dto.endDate   ? new Date(dto.endDate)   : undefined,
      },
      include: {
        attachments: true,
        subject: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const attachments = await this.tenantPrisma.client.portfolioAttachment.findMany({
      where: { portfolioId: id },
    });
    await Promise.allSettled(attachments.map((a) => this.storage.delete(a.fileUrl)));

    return this.tenantPrisma.client.studentPortfolio.delete({ where: { id } });
  }

  // ── Attachments ───────────────────────────────────────────────────────────────

  async addAttachment(id: string, file: Express.Multer.File, tenantSlug: string) {
    if (!ALLOWED_MIME.includes(file.mimetype))
      throw new Error('Only JPEG, PNG, WebP, or PDF files are accepted');
    if (file.size > MAX_BYTES)
      throw new Error('File must be under 10 MB');

    await this.findOne(id);

    const fileUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'portfolio-files',
      tenantSlug,
    );

    return this.tenantPrisma.client.portfolioAttachment.create({
      data: {
        portfolioId: id,
        fileUrl,
        fileName:  file.originalname,
        mimeType:  file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async removeAttachment(id: string, attachmentId: string) {
    const attachment = await this.tenantPrisma.client.portfolioAttachment.findFirst({
      where: { id: attachmentId, portfolioId: id },
    });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);

    await this.storage.delete(attachment.fileUrl);
    return this.tenantPrisma.client.portfolioAttachment.delete({ where: { id: attachmentId } });
  }
}
