/**
 * Assignment feature tenant seed.
 *
 * Usage:
 *   SEED_SCHEMA=tenant_school_1 npx ts-node --project tsconfig.seed.json prisma/tenant/seed-assignments-feature.ts
 *
 * Depends on `seed-attendance-feature.ts` because it reuses the seeded
 * X Science Aurora classroom, Matematika Wajib subject, teacher, and students.
 */

import { PrismaClient as PublicPrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '../../src/generated/tenant-client';
import { tenantSeedUrl } from './seed-url';

type TenantClient = InstanceType<typeof TenantPrismaClient>;
type SubmissionStatus = 'submitted' | 'graded' | 'returned';

const PUBLIC_PRISMA = new PublicPrismaClient();
const schema = process.env.SEED_SCHEMA ?? 'tenant_school_1';
const prisma = new TenantPrismaClient({
  datasources: { db: { url: tenantSeedUrl(schema) } },
});

const CLASSROOM_ID = '5834d961-b561-458e-bcb8-088ec44c847b';
const SUBJECT_ID = 'd14eeaa3-961b-477f-b339-c6528852017e';
const CREATED_BY_USER_ID = '769fee3f-1383-445f-b2cc-b2ba70a3cbfb';

const CLASSROOM_NAME = 'X Science Aurora';
const SUBJECT_CODE = 'AF-MTK';
const SUBJECT_NAME = 'Matematika Wajib';
const TEACHER_NAME = 'Ratih Prameswari';

const ASSIGNMENTS = [
  {
    key: 'linear-functions',
    title: 'AF Assignment 01 - Fungsi Linear dan Grafik',
    description:
      'Analisis gradien, titik potong, dan interpretasi grafik fungsi linear dalam konteks sehari-hari.',
    dueAt: '2026-06-10T16:59:00.000Z',
    status: 'closed',
    maxScore: 100,
    allowLateSubmission: true,
  },
  {
    key: 'quadratic-modeling',
    title: 'AF Assignment 02 - Model Kuadrat',
    description:
      'Menyusun model fungsi kuadrat dari data, menentukan titik puncak, dan menjelaskan maknanya.',
    dueAt: '2026-06-13T16:59:00.000Z',
    status: 'published',
    maxScore: 100,
    allowLateSubmission: true,
  },
  {
    key: 'statistics-project',
    title: 'AF Assignment 03 - Statistika Kelas',
    description:
      'Kumpulkan data sederhana, hitung ukuran pemusatan, dan buat kesimpulan singkat.',
    dueAt: '2026-06-17T16:59:00.000Z',
    status: 'published',
    maxScore: 100,
    allowLateSubmission: true,
  },
  {
    key: 'trigonometry-practice',
    title: 'AF Assignment 04 - Perbandingan Trigonometri',
    description:
      'Latihan penerapan sinus, cosinus, dan tangen pada segitiga siku-siku.',
    dueAt: '2026-06-20T16:59:00.000Z',
    status: 'published',
    maxScore: 100,
    allowLateSubmission: false,
  },
  {
    key: 'portfolio-reflection',
    title: 'AF Assignment 05 - Refleksi Pemecahan Masalah',
    description:
      'Pilih dua soal menantang, tulis strategi penyelesaian, dan refleksikan kesalahan umum.',
    dueAt: '2026-06-24T16:59:00.000Z',
    status: 'published',
    maxScore: 100,
    allowLateSubmission: true,
  },
] as const;

function log(message: string) {
  console.log(`[assignments-feature:${schema}] ${message}`);
}

function timestamptz(value: string) {
  return new Date(value);
}

function hash(input: string) {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

function scoreFor(seed: string, offset = 0) {
  return 72 + ((hash(seed) + offset) % 24);
}

function submissionStatus(assignmentKey: string, studentIndex: number): SubmissionStatus {
  if (assignmentKey === 'statistics-project') {
    return studentIndex % 5 === 0 ? 'returned' : 'submitted';
  }
  if (assignmentKey === 'portfolio-reflection') {
    return studentIndex % 4 === 0 ? 'submitted' : 'graded';
  }
  return 'graded';
}

function submittedAtFor(dueAt: Date, studentIndex: number) {
  const hoursBeforeDue = 6 + (studentIndex % 5) * 5;
  return new Date(dueAt.getTime() - hoursBeforeDue * 60 * 60 * 1000);
}

function maybeLate(assignmentKey: string, studentIndex: number) {
  return assignmentKey === 'linear-functions' && studentIndex % 6 === 0;
}

function fileUrl(path: string) {
  return `https://seed.local/assignment-feature/${path}`;
}

async function ensureSchema(targetSchema: string) {
  await PUBLIC_PRISMA.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`,
  );
}

async function requiredFixture(db: TenantClient) {
  const [classroom, subject, teacher] = await Promise.all([
    db.classroom.findFirst({
      where: { id: CLASSROOM_ID, deletedAt: null },
      include: { academicYear: true },
    }),
    db.subject.findFirst({
      where: { id: SUBJECT_ID, code: SUBJECT_CODE, deletedAt: null },
    }),
    db.user.findFirst({
      where: { id: CREATED_BY_USER_ID, fullName: TEACHER_NAME, deletedAt: null },
      include: { teacherProfile: true },
    }),
  ]);

  if (!classroom || classroom.name !== CLASSROOM_NAME) {
    throw new Error(
      `Required classroom fixture not found: ${CLASSROOM_NAME} (${CLASSROOM_ID}). Run seed:tenant:attendance-feature first.`,
    );
  }

  if (!subject || subject.name !== SUBJECT_NAME) {
    throw new Error(
      `Required subject fixture not found: ${SUBJECT_NAME} (${SUBJECT_ID}). Run seed:tenant:attendance-feature first.`,
    );
  }

  if (!teacher?.teacherProfile) {
    throw new Error(
      `Required teacher fixture not found: ${TEACHER_NAME} (${CREATED_BY_USER_ID}). Run seed:tenant:attendance-feature first.`,
    );
  }

  return { classroom, subject, teacher };
}

async function ensureTeacherAssignment(
  db: TenantClient,
  teacherProfileId: string,
) {
  const classSubject = await db.classSubject.findUnique({
    where: {
      classroomId_subjectId: {
        classroomId: CLASSROOM_ID,
        subjectId: SUBJECT_ID,
      },
    },
  });

  if (classSubject) {
    await db.classSubject.update({
      where: { id: classSubject.id },
      data: { teacherProfileId },
    });
    return;
  }

  await db.classSubject.create({
    data: {
      classroomId: CLASSROOM_ID,
      subjectId: SUBJECT_ID,
      teacherProfileId,
    },
  });
}

async function ensureAssignmentAttachment(
  db: TenantClient,
  assignmentId: string,
  key: string,
) {
  const fileName = `${key}-instructions.pdf`;
  const existing = await db.assignmentAttachment.findFirst({
    where: { assignmentId, fileName },
  });

  const data = {
    fileUrl: fileUrl(`instructions/${fileName}`),
    fileName,
    mimeType: 'application/pdf',
    sizeBytes: 184_320,
  };

  if (existing) {
    await db.assignmentAttachment.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await db.assignmentAttachment.create({
    data: { assignmentId, ...data },
  });
}

async function ensureSubmissionAttachment(
  db: TenantClient,
  submissionId: string,
  assignmentKey: string,
  studentSlug: string,
) {
  const fileName = `${studentSlug}-${assignmentKey}-answer.pdf`;
  const existing = await db.submissionAttachment.findFirst({
    where: { submissionId, fileName },
  });

  const data = {
    fileUrl: fileUrl(`submissions/${assignmentKey}/${fileName}`),
    fileName,
    mimeType: 'application/pdf',
    sizeBytes: 96_000 + (hash(fileName) % 48_000),
  };

  if (existing) {
    await db.submissionAttachment.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await db.submissionAttachment.create({
    data: { submissionId, ...data },
  });
}

async function main() {
  await ensureSchema(schema);
  log('Seeding X Science Aurora assignment feature data');

  const { classroom, subject, teacher } = await requiredFixture(prisma);
  const teacherProfileId = teacher.teacherProfile!.id;
  await ensureTeacherAssignment(prisma, teacherProfileId);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classroomId: CLASSROOM_ID,
      status: 'active',
      studentProfile: { status: 'active' },
    },
    include: {
      studentProfile: {
        include: {
          user: { select: { id: true, fullName: true, username: true } },
        },
      },
    },
    orderBy: { enrolledAt: 'asc' },
  });

  if (!enrollments.length) {
    throw new Error(
      `No active students found in ${CLASSROOM_NAME}. Run seed:tenant:attendance-feature first.`,
    );
  }

  let assignmentCount = 0;
  let submissionCount = 0;

  for (const fixture of ASSIGNMENTS) {
    const dueAt = timestamptz(fixture.dueAt);
    const publishedAt = new Date(dueAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const closedAt =
      fixture.status === 'closed'
        ? new Date(dueAt.getTime() + 24 * 60 * 60 * 1000)
        : null;

    const existing = await prisma.assignment.findFirst({
      where: {
        classroomId: classroom.id,
        subjectId: subject.id,
        academicYearId: classroom.academicYearId,
        title: fixture.title,
      },
    });

    const assignment = existing
      ? await prisma.assignment.update({
          where: { id: existing.id },
          data: {
            createdByUserId: teacher.id,
            type: 'file_upload',
            description: fixture.description,
            dueAt,
            maxScore: fixture.maxScore,
            allowLateSubmission: fixture.allowLateSubmission,
            status: fixture.status,
            publishedAt,
            closedAt,
            deletedAt: null,
          },
        })
      : await prisma.assignment.create({
          data: {
            classroomId: classroom.id,
            subjectId: subject.id,
            academicYearId: classroom.academicYearId,
            createdByUserId: teacher.id,
            type: 'file_upload',
            title: fixture.title,
            description: fixture.description,
            dueAt,
            maxScore: fixture.maxScore,
            allowLateSubmission: fixture.allowLateSubmission,
            status: fixture.status,
            publishedAt,
            closedAt,
          },
        });

    assignmentCount += 1;
    await ensureAssignmentAttachment(prisma, assignment.id, fixture.key);

    for (let index = 0; index < enrollments.length; index += 1) {
      const enrollment = enrollments[index];
      const student = enrollment.studentProfile;
      const status = submissionStatus(fixture.key, index);
      const isLate = maybeLate(fixture.key, index);
      const submittedAt = isLate
        ? new Date(dueAt.getTime() + 3 * 60 * 60 * 1000)
        : submittedAtFor(dueAt, index);
      const gradedAt =
        status === 'graded' || status === 'returned'
          ? new Date(submittedAt.getTime() + 36 * 60 * 60 * 1000)
          : null;
      const score =
        status === 'graded' || status === 'returned'
          ? scoreFor(`${fixture.key}:${student.id}`, index)
          : null;

      const submission = await prisma.assignmentSubmission.upsert({
        where: {
          assignmentId_studentProfileId: {
            assignmentId: assignment.id,
            studentProfileId: student.id,
          },
        },
        create: {
          assignmentId: assignment.id,
          studentProfileId: student.id,
          status,
          submittedAt,
          isLate,
          attemptNumber: status === 'returned' ? 2 : 1,
          notes: `Seeded ${SUBJECT_NAME} response for ${fixture.title}.`,
          score,
          feedback:
            status === 'submitted'
              ? null
              : status === 'returned'
                ? 'Revision requested: clarify the reasoning and resubmit the corrected work.'
                : 'Good mathematical reasoning. Review notation and final answer formatting.',
          gradedByUserId: gradedAt ? teacher.id : null,
          gradedAt,
          deletedAt: null,
        },
        update: {
          status,
          submittedAt,
          isLate,
          attemptNumber: status === 'returned' ? 2 : 1,
          notes: `Seeded ${SUBJECT_NAME} response for ${fixture.title}.`,
          score,
          feedback:
            status === 'submitted'
              ? null
              : status === 'returned'
                ? 'Revision requested: clarify the reasoning and resubmit the corrected work.'
                : 'Good mathematical reasoning. Review notation and final answer formatting.',
          gradedByUserId: gradedAt ? teacher.id : null,
          gradedAt,
          deletedAt: null,
        },
      });

      const studentSlug =
        student.user.username ??
        student.user.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await ensureSubmissionAttachment(
        prisma,
        submission.id,
        fixture.key,
        studentSlug,
      );
      submissionCount += 1;
    }
  }

  log(
    `Seeded ${assignmentCount} assignments and ${submissionCount} submissions for ${CLASSROOM_NAME} / ${SUBJECT_NAME}`,
  );
  log(
    `Teacher: ${teacher.fullName}; Academic year: ${classroom.academicYear.label} semester ${classroom.academicYear.semester}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await PUBLIC_PRISMA.$disconnect();
  });
