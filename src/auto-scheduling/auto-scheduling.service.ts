import { Injectable, Logger } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';

interface Requirement {
  classroomId: string;
  classroomName: string;
  subjectId: string;
  subjectName: string;
  teacherProfileId: string | null;
  roomId: string | null;
  sessionsPerWeek: number;
  academicYear: string;
  semester: number;
}

export interface UnresolvedEntry {
  classroomId: string;
  classroomName: string;
  subjectId: string;
  subjectName: string;
  sessionsNeeded: number;
  sessionsScheduled: number;
  reason: string;
}

export interface GenerateResult {
  stats: {
    requirementsTotal: number;
    sessionsTotal: number;
    sessionsScheduled: number;
    sessionsFailed: number;
    draftsClearedCount: number;
    durationMs: number;
  };
  unresolved: UnresolvedEntry[];
  log: string[];
}

const DAY_ORDER = [1, 2, 3, 4, 5];

@Injectable()
export class AutoSchedulingService {
  private readonly logger = new Logger(AutoSchedulingService.name);

  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async generate(dto: GenerateScheduleDto): Promise<GenerateResult> {
    const start = Date.now();
    const maxConsecutive = dto.maxConsecutive ?? 2;
    const clearDrafts = dto.clearDrafts ?? true;
    const log: string[] = [];
    const unresolved: UnresolvedEntry[] = [];
    const emit = (message: string) => {
      this.logger.log(message);
      log.push(message);
    };

    emit(`[AutoScheduler] START academicYear=${dto.academicYear} semester=${dto.semester}`);

    const [periodRows, rawRequirements, existingEntries] = await Promise.all([
      this.tenantPrisma.client.periodRow.findMany({
        where: { kind: 'lesson' },
        select: { id: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.tenantPrisma.client.scheduleRequirement.findMany({
        where: {
          academicYear: dto.academicYear,
          semester: dto.semester,
          ...(dto.classroomIds?.length ? { classroomId: { in: dto.classroomIds } } : {}),
        },
        include: {
          classroom: { select: { name: true } },
          subject: { select: { name: true } },
        },
      }),
      this.tenantPrisma.client.scheduleEntry.findMany({
        where: {
          deletedAt: null,
          dayOfWeek: { not: null },
          periodRowId: { not: null },
          schedule: {
            deletedAt: null,
            status: 'published',
            academicYear: dto.academicYear,
            semester: dto.semester,
          },
        },
        select: {
          subjectId: true,
          teacherProfileId: true,
          roomId: true,
          dayOfWeek: true,
          periodRowId: true,
          schedule: { select: { classroomId: true } },
        },
      }),
    ]);

    if (!periodRows.length) {
      emit('[AutoScheduler] ABORT - no lesson period rows configured');
      return this.result(rawRequirements.length, 0, 0, 0, Date.now() - start, unresolved, log);
    }

    let draftsClearedCount = 0;
    if (clearDrafts) {
      const cleared = await this.tenantPrisma.client.schedule.updateMany({
        where: {
          academicYear: dto.academicYear,
          semester: dto.semester,
          status: 'draft',
          deletedAt: null,
          ...(dto.classroomIds?.length ? { classroomId: { in: dto.classroomIds } } : {}),
        },
        data: { deletedAt: new Date(), status: 'archived', archivedAt: new Date() },
      });
      draftsClearedCount = cleared.count;
    }

    const classOccupied = new Map<string, Set<string>>();
    const teacherOccupied = new Map<string, Set<string>>();
    const roomOccupied = new Map<string, Set<string>>();
    const classSlotSubject = new Map<string, string>();

    const addToSet = (map: Map<string, Set<string>>, id: string, key: string) => {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id)!.add(key);
    };

    for (const entry of existingEntries) {
      if (!entry.dayOfWeek || !entry.periodRowId) continue;
      const key = `${entry.dayOfWeek}-${entry.periodRowId}`;
      addToSet(classOccupied, entry.schedule.classroomId, key);
      addToSet(teacherOccupied, entry.teacherProfileId, key);
      addToSet(roomOccupied, entry.roomId, key);
      classSlotSubject.set(`${entry.schedule.classroomId}-${key}`, entry.subjectId);
    }

    const requirements: Requirement[] = rawRequirements
      .map((requirement) => ({
        classroomId: requirement.classroomId,
        classroomName: requirement.classroom.name,
        subjectId: requirement.subjectId,
        subjectName: requirement.subject.name,
        teacherProfileId: requirement.teacherProfileId,
        roomId: requirement.roomId,
        sessionsPerWeek: requirement.sessionsPerWeek,
        academicYear: requirement.academicYear,
        semester: requirement.semester,
      }))
      .sort((a, b) => b.sessionsPerWeek - a.sessionsPerWeek);

    const toInsert: Array<Requirement & { dayOfWeek: number; periodRowId: string }> = [];
    let sessionsTotal = 0;
    let sessionsScheduled = 0;

    for (const requirement of requirements) {
      sessionsTotal += requirement.sessionsPerWeek;

      if (!requirement.teacherProfileId || !requirement.roomId) {
        unresolved.push({
          classroomId: requirement.classroomId,
          classroomName: requirement.classroomName,
          subjectId: requirement.subjectId,
          subjectName: requirement.subjectName,
          sessionsNeeded: requirement.sessionsPerWeek,
          sessionsScheduled: 0,
          reason: 'Requirement must have teacherProfileId and roomId before auto-scheduling',
        });
        continue;
      }

      let scheduled = 0;
      outer:
      for (const day of DAY_ORDER) {
        for (let index = 0; index < periodRows.length; index++) {
          if (scheduled >= requirement.sessionsPerWeek) break outer;
          const period = periodRows[index];
          const key = `${day}-${period.id}`;

          if (classOccupied.get(requirement.classroomId)?.has(key)) continue;
          if (teacherOccupied.get(requirement.teacherProfileId)?.has(key)) continue;
          if (roomOccupied.get(requirement.roomId)?.has(key)) continue;

          let consecutiveCount = 0;
          if (index >= 1 && classSlotSubject.get(`${requirement.classroomId}-${day}-${periodRows[index - 1].id}`) === requirement.subjectId) {
            consecutiveCount++;
          }
          if (index >= 2 && classSlotSubject.get(`${requirement.classroomId}-${day}-${periodRows[index - 2].id}`) === requirement.subjectId) {
            consecutiveCount++;
          }
          if (consecutiveCount >= maxConsecutive) continue;

          toInsert.push({ ...requirement, dayOfWeek: day, periodRowId: period.id });
          addToSet(classOccupied, requirement.classroomId, key);
          addToSet(teacherOccupied, requirement.teacherProfileId, key);
          addToSet(roomOccupied, requirement.roomId, key);
          classSlotSubject.set(`${requirement.classroomId}-${key}`, requirement.subjectId);
          scheduled++;
          sessionsScheduled++;
        }
      }

      if (scheduled < requirement.sessionsPerWeek) {
        unresolved.push({
          classroomId: requirement.classroomId,
          classroomName: requirement.classroomName,
          subjectId: requirement.subjectId,
          subjectName: requirement.subjectName,
          sessionsNeeded: requirement.sessionsPerWeek,
          sessionsScheduled: scheduled,
          reason: `No available period for ${requirement.sessionsPerWeek - scheduled} session(s)`,
        });
      }
    }

    await this.tenantPrisma.client.$transaction(async (tx) => {
      const scheduleIdByClass = new Map<string, string>();

      for (const row of toInsert) {
        const key = `${row.classroomId}:${row.academicYear}:${row.semester}`;
        let scheduleId = scheduleIdByClass.get(key);

        if (!scheduleId) {
          const schedule = await tx.schedule.upsert({
            where: {
              classroomId_academicYear_semester: {
                classroomId: row.classroomId,
                academicYear: row.academicYear,
                semester: row.semester,
              },
            },
            create: {
              classroomId: row.classroomId,
              academicYear: row.academicYear,
              semester: row.semester,
              status: 'draft',
            },
            update: { status: 'draft', deletedAt: null },
            select: { id: true },
          });
          scheduleId = schedule.id;
          scheduleIdByClass.set(key, scheduleId);
        }

        await tx.scheduleEntry.create({
          data: {
            scheduleId,
            subjectId: row.subjectId,
            teacherProfileId: row.teacherProfileId!,
            roomId: row.roomId!,
            dayOfWeek: row.dayOfWeek,
            periodRowId: row.periodRowId,
          },
        });
      }
    });

    const durationMs = Date.now() - start;
    emit(`[AutoScheduler] DONE in ${durationMs}ms - ${sessionsScheduled}/${sessionsTotal} scheduled`);
    return this.result(requirements.length, sessionsTotal, sessionsScheduled, draftsClearedCount, durationMs, unresolved, log);
  }

  private result(
    requirementsTotal: number,
    sessionsTotal: number,
    sessionsScheduled: number,
    draftsClearedCount: number,
    durationMs: number,
    unresolved: UnresolvedEntry[],
    log: string[],
  ): GenerateResult {
    return {
      stats: {
        requirementsTotal,
        sessionsTotal,
        sessionsScheduled,
        sessionsFailed: sessionsTotal - sessionsScheduled,
        draftsClearedCount,
        durationMs,
      },
      unresolved,
      log,
    };
  }
}
