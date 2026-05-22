import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { AchievementCategory } from '../common/enums/achievement-category.enum';
import { AchievementLevel } from '../common/enums/achievement-level.enum';
import { paginatedResult } from '../common/utils/paginate';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class StudentAchievementsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  async findAll(filters: {
    studentProfileId?: string;
    category?: AchievementCategory;
    level?: AchievementLevel;
    year?: number;
    classroomId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { studentProfileId, category, level, year, classroomId, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...(studentProfileId ? { studentProfileId } : {}),
      ...(category ? { category } : {}),
      ...(level    ? { level }    : {}),
      ...(year ? { achievedAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } : {}),
      ...(classroomId ? { studentProfile: { enrollments: { some: { classroomId, status: 'active' as const } } } } : {}),
      ...(search ? {
        OR: [
          { title:     { contains: search, mode: 'insensitive' as const } },
          { eventName: { contains: search, mode: 'insensitive' as const } },
          { organizer: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const include = {
      attachments: true,
      studentProfile: {
        select: { id: true, user: { select: { id: true, fullName: true, avatarUrl: true } } },
      },
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.studentAchievement.findMany({ where, include, skip, take: limit, orderBy: { achievedAt: 'desc' } }),
      this.tenantPrisma.client.studentAchievement.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const achievement = await this.tenantPrisma.client.studentAchievement.findUnique({
      where: { id },
      include: {
        attachments: true,
        studentProfile: {
          select: {
            id: true,
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!achievement) throw new NotFoundException(`Achievement ${id} not found`);
    return achievement;
  }

  async create(dto: CreateAchievementDto) {
    return this.tenantPrisma.client.studentAchievement.create({
      data: {
        studentProfileId: dto.studentProfileId,
        title:            dto.title,
        category:         dto.category,
        level:            dto.level,
        description:      dto.description,
        organizer:        dto.organizer,
        eventName:        dto.eventName,
        achievedAt:       new Date(dto.achievedAt),
        rank:             dto.rank,
      },
      include: { attachments: true },
    });
  }

  async update(id: string, dto: UpdateAchievementDto) {
    await this.findOne(id);
    return this.tenantPrisma.client.studentAchievement.update({
      where: { id },
      data: {
        title:       dto.title,
        category:    dto.category,
        level:       dto.level,
        description: dto.description,
        organizer:   dto.organizer,
        eventName:   dto.eventName,
        achievedAt:  dto.achievedAt ? new Date(dto.achievedAt) : undefined,
        rank:        dto.rank,
      },
      include: { attachments: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const attachments = await this.tenantPrisma.client.achievementAttachment.findMany({
      where: { achievementId: id },
    });
    await Promise.allSettled(attachments.map((a) => this.storage.delete(a.fileUrl)));

    return this.tenantPrisma.client.studentAchievement.delete({ where: { id } });
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
      'achievement-files',
      tenantSlug,
    );

    return this.tenantPrisma.client.achievementAttachment.create({
      data: {
        achievementId: id,
        fileUrl,
        fileName:  file.originalname,
        mimeType:  file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async removeAttachment(id: string, attachmentId: string) {
    const attachment = await this.tenantPrisma.client.achievementAttachment.findFirst({
      where: { id: attachmentId, achievementId: id },
    });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);

    await this.storage.delete(attachment.fileUrl);
    return this.tenantPrisma.client.achievementAttachment.delete({ where: { id: attachmentId } });
  }
}
