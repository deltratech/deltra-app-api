import { Injectable, Logger } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { DayOfWeek } from '../common/enums/day-of-week.enum';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Requirement {
  id:               string;
  classroomId:      string;
  classroomName:    string;
  subjectId:        string;
  subjectName:      string;
  teacherProfileId: string | null;
  roomId:           string | null;
  sessionsPerWeek:  number;
  academicYear:     string;
  semester:         number;
  teacherLoad:      number; // total sessions across all requirements for this teacher
}

interface TimeSlot {
  id:        string;
  label:     string;
  sortOrder: number;
}

export interface UnresolvedEntry {
  classroomId:       string;
  classroomName:     string;
  subjectId:         string;
  subjectName:       string;
  sessionsNeeded:    number;
  sessionsScheduled: number;
  reason:            string;
}

export interface GenerateResult {
  stats: {
    requirementsTotal:    number;
    sessionsTotal:        number;
    sessionsScheduled:    number;
    sessionsFailed:       number;
    draftsClearedCount:   number;
    durationMs:           number;
  };
  unresolved: UnresolvedEntry[];
  log:        string[];
}

// Day iteration order — deterministic Monday-first
const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.monday,
  DayOfWeek.tuesday,
  DayOfWeek.wednesday,
  DayOfWeek.thursday,
  DayOfWeek.friday,
  DayOfWeek.saturday,
];

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class AutoSchedulingService {
  private readonly logger = new Logger(AutoSchedulingService.name);

  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async generate(dto: GenerateScheduleDto): Promise<GenerateResult> {
    const start = Date.now();
    const maxConsecutive = dto.maxConsecutive ?? 2;
    const clearDrafts    = dto.clearDrafts    ?? true;
    const log: string[]  = [];

    const emit = (msg: string) => {
      this.logger.log(msg);
      log.push(msg);
    };

    emit(`[AutoScheduler] START academicYear=${dto.academicYear} semester=${dto.semester} maxConsecutive=${maxConsecutive}`);

    // ── 1. Preload all data in parallel — zero N+1 ──────────────────────────

    const [timeSlots, rawRequirements, unavailabilityRows, existingActive] = await Promise.all([
      this.tenantPrisma.client.timeSlot.findMany({ orderBy: { sortOrder: 'asc' } }),

      this.tenantPrisma.client.scheduleRequirement.findMany({
        where: {
          academicYear: dto.academicYear,
          semester:     dto.semester,
          ...(dto.classroomIds?.length ? { classroomId: { in: dto.classroomIds } } : {}),
        },
        include: {
          classroom: { select: { name: true } },
          subject:   { select: { name: true } },
        },
      }),

      this.tenantPrisma.client.teacherUnavailability.findMany({
        select: { teacherProfileId: true, dayOfWeek: true, timeSlotId: true },
      }),

      // Active/published schedules outside our scope must not be double-booked
      this.tenantPrisma.client.schedule.findMany({
        where: {
          deletedAt: null,
          status:    { in: ['published'] },
          academicYear: dto.academicYear,
          semester:     dto.semester,
        },
        select: {
          classroomId:      true,
          teacherProfileId: true,
          roomId:           true,
          timeSlotId:       true,
          dayOfWeek:        true,
          subjectId:        true,
        },
      }),
    ]);

    emit(`[AutoScheduler] Loaded: ${timeSlots.length} slots, ${rawRequirements.length} requirements, ${unavailabilityRows.length} unavailability, ${existingActive.length} active schedules`);

    if (!timeSlots.length) {
      emit('[AutoScheduler] ABORT — no time slots configured');
      return { stats: { requirementsTotal: 0, sessionsTotal: 0, sessionsScheduled: 0, sessionsFailed: 0, draftsClearedCount: 0, durationMs: Date.now() - start }, unresolved: [], log };
    }

    // ── 2. Build teacher-load map for difficulty scoring ────────────────────
    const teacherLoadMap = new Map<string, number>();
    for (const r of rawRequirements) {
      if (r.teacherProfileId) {
        teacherLoadMap.set(r.teacherProfileId, (teacherLoadMap.get(r.teacherProfileId) ?? 0) + r.sessionsPerWeek);
      }
    }

    // ── 3. Sort requirements by difficulty (greedy hardest-first) ───────────
    //   Primary:   sessionsPerWeek DESC  (harder to fit)
    //   Secondary: teacher load DESC     (busiest teacher = more likely to conflict)
    const requirements: Requirement[] = rawRequirements
      .map((r) => ({
        id:               r.id,
        classroomId:      r.classroomId,
        classroomName:    r.classroom.name,
        subjectId:        r.subjectId,
        subjectName:      r.subject.name,
        teacherProfileId: r.teacherProfileId,
        roomId:           r.roomId,
        sessionsPerWeek:  r.sessionsPerWeek,
        academicYear:     r.academicYear,
        semester:         r.semester,
        teacherLoad:      r.teacherProfileId ? (teacherLoadMap.get(r.teacherProfileId) ?? 0) : 0,
      }))
      .sort((a, b) =>
        b.sessionsPerWeek - a.sessionsPerWeek ||
        b.teacherLoad     - a.teacherLoad,
      );

    emit(`[AutoScheduler] Requirements sorted. Top 3: ${requirements.slice(0, 3).map((r) => `${r.classroomName}/${r.subjectName}(${r.sessionsPerWeek})`).join(', ')}`);

    // ── 4. Build occupied maps from existing published schedules ────────────

    // key = `${day}-${timeSlotId}`
    const classOccupied   = new Map<string, Set<string>>();  // classroomId → keys
    const teacherOccupied = new Map<string, Set<string>>();  // teacherProfileId → keys
    const roomOccupied    = new Map<string, Set<string>>();  // roomId → keys

    // key = `${classroomId}-${day}-${timeSlotId}` → subjectId (for consecutive check)
    const classSlotSubject = new Map<string, string>();

    const addToSet = (map: Map<string, Set<string>>, id: string, key: string) => {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id)!.add(key);
    };

    for (const s of existingActive) {
      const key = `${s.dayOfWeek}-${s.timeSlotId}`;
      addToSet(classOccupied, s.classroomId, key);
      if (s.teacherProfileId) addToSet(teacherOccupied, s.teacherProfileId, key);
      if (s.roomId)           addToSet(roomOccupied, s.roomId, key);
      classSlotSubject.set(`${s.classroomId}-${key}`, s.subjectId);
    }

    // ── 5. Build unavailability set ─────────────────────────────────────────
    // key = `${teacherProfileId}-${day}-${timeSlotId}`
    const unavailableKeys = new Set<string>(
      unavailabilityRows.map((u) => `${u.teacherProfileId}-${u.dayOfWeek}-${u.timeSlotId}`),
    );

    // ── 6. Clear existing drafts inside a transaction ───────────────────────
    let draftsClearedCount = 0;

    if (clearDrafts) {
      const cleared = await this.tenantPrisma.client.schedule.updateMany({
        where: {
          academicYear: dto.academicYear,
          semester:     dto.semester,
          status:       'draft',
          deletedAt:    null,
          ...(dto.classroomIds?.length ? { classroomId: { in: dto.classroomIds } } : {}),
        },
        data: { deletedAt: new Date(), status: 'archived' },
      });
      draftsClearedCount = cleared.count;
      emit(`[AutoScheduler] Cleared ${draftsClearedCount} existing draft schedules`);
    }

    // ── 7. Run greedy algorithm ─────────────────────────────────────────────

    interface ScheduleRow {
      classroomId:      string;
      subjectId:        string;
      teacherProfileId: string | null;
      roomId:           string | null;
      timeSlotId:       string;
      dayOfWeek:        DayOfWeek;
      academicYear:     string;
      semester:         number;
      status:           'draft';
      notes:            string | null;
    }

    const toInsert: ScheduleRow[] = [];
    const unresolved: UnresolvedEntry[] = [];
    let sessionsScheduled = 0;
    let sessionsTotal     = 0;

    for (const req of requirements) {
      const needed = req.sessionsPerWeek;
      sessionsTotal += needed;
      let scheduled = 0;

      outer:
      for (const day of DAY_ORDER) {
        for (let si = 0; si < timeSlots.length; si++) {
          if (scheduled >= needed) break outer;

          const slot = timeSlots[si];
          const slotKey = `${day}-${slot.id}`;

          // ── Hard constraint: class conflict
          if (classOccupied.get(req.classroomId)?.has(slotKey)) continue;

          // ── Hard constraint: teacher unavailability + conflict
          if (req.teacherProfileId) {
            if (unavailableKeys.has(`${req.teacherProfileId}-${slotKey}`)) continue;
            if (teacherOccupied.get(req.teacherProfileId)?.has(slotKey)) continue;
          }

          // ── Hard constraint: room conflict
          if (req.roomId && roomOccupied.get(req.roomId)?.has(slotKey)) continue;

          // ── Hard constraint: consecutive sessions
          let consecutiveCount = 0;
          if (si >= 1) {
            const prevKey = `${req.classroomId}-${day}-${timeSlots[si - 1].id}`;
            if (classSlotSubject.get(prevKey) === req.subjectId) {
              consecutiveCount++;
              if (si >= 2) {
                const prev2Key = `${req.classroomId}-${day}-${timeSlots[si - 2].id}`;
                if (classSlotSubject.get(prev2Key) === req.subjectId) consecutiveCount++;
              }
            }
          }
          if (consecutiveCount >= maxConsecutive) continue;

          // ── All constraints passed — assign this slot ───────────────────

          toInsert.push({
            classroomId:      req.classroomId,
            subjectId:        req.subjectId,
            teacherProfileId: req.teacherProfileId,
            roomId:           req.roomId,
            timeSlotId:       slot.id,
            dayOfWeek:        day,
            academicYear:     req.academicYear,
            semester:         req.semester,
            status:           'draft',
            notes:            null,
          });

          // Update in-memory maps immediately
          addToSet(classOccupied, req.classroomId, slotKey);
          if (req.teacherProfileId) addToSet(teacherOccupied, req.teacherProfileId, slotKey);
          if (req.roomId)           addToSet(roomOccupied, req.roomId, slotKey);
          classSlotSubject.set(`${req.classroomId}-${slotKey}`, req.subjectId);

          scheduled++;
          sessionsScheduled++;
        }
      }

      const failed = needed - scheduled;
      if (failed > 0) {
        emit(`[AutoScheduler] UNRESOLVED ${req.classroomName}/${req.subjectName}: ${scheduled}/${needed} sessions placed`);
        unresolved.push({
          classroomId:       req.classroomId,
          classroomName:     req.classroomName,
          subjectId:         req.subjectId,
          subjectName:       req.subjectName,
          sessionsNeeded:    needed,
          sessionsScheduled: scheduled,
          reason:            `No available slot for ${failed} session(s) — check teacher availability, room conflicts, and time slot count`,
        });
      } else {
        emit(`[AutoScheduler] OK ${req.classroomName}/${req.subjectName}: ${scheduled}/${needed}`);
      }
    }

    // ── 8. Bulk insert inside transaction ───────────────────────────────────
    emit(`[AutoScheduler] Inserting ${toInsert.length} schedules in transaction...`);

    await this.tenantPrisma.client.$transaction(
      toInsert.map((data) => this.tenantPrisma.client.schedule.create({ data })),
    );

    const durationMs = Date.now() - start;
    emit(`[AutoScheduler] DONE in ${durationMs}ms — ${sessionsScheduled}/${sessionsTotal} scheduled, ${unresolved.length} unresolved`);

    return {
      stats: {
        requirementsTotal:  requirements.length,
        sessionsTotal,
        sessionsScheduled,
        sessionsFailed:     sessionsTotal - sessionsScheduled,
        draftsClearedCount,
        durationMs,
      },
      unresolved,
      log,
    };
  }
}
