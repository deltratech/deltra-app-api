/**
 * Attendance feature tenant seed.
 *
 * Usage:
 *   SEED_SCHEMA=tenant_school_1 npx ts-node --project tsconfig.seed.json prisma/tenant/seed-attendance-feature.ts
 *
 * The seed is idempotent and intentionally namespaced with `af-` usernames and
 * `attendance-feature.seed` emails so it can run beside the larger tenant seeds.
 */

import { PrismaClient as PublicPrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '../../src/generated/tenant-client';
import * as bcrypt from 'bcrypt';
import { tenantSeedUrl } from './seed-url';

type TenantClient = InstanceType<typeof TenantPrismaClient>;
type AttendanceStatus = 'present' | 'late' | 'excused' | 'sick' | 'absent';

const PUBLIC_PRISMA = new PublicPrismaClient();
const schema = process.env.SEED_SCHEMA ?? 'tenant_school_1';
const prisma = new TenantPrismaClient({
  datasources: { db: { url: tenantSeedUrl(schema) } },
});

const PASSWORD = process.env.SEED_PASSWORD ?? 'password123';

const SUBJECTS = [
  {
    code: 'AF-MTK',
    name: 'Matematika Wajib',
    description: 'Algebra, functions, statistics, and mathematical reasoning.',
  },
  {
    code: 'AF-BIN',
    name: 'Bahasa Indonesia',
    description: 'Reading, writing, literature, and public communication.',
  },
  {
    code: 'AF-ING',
    name: 'Bahasa Inggris',
    description: 'Academic English, conversation, reading, and writing.',
  },
  {
    code: 'AF-FIS',
    name: 'Fisika',
    description: 'Mechanics, measurement, waves, and laboratory practice.',
  },
  {
    code: 'AF-KIM',
    name: 'Kimia',
    description: 'Matter, atomic structure, bonding, and reactions.',
  },
  {
    code: 'AF-BIO',
    name: 'Biologi',
    description: 'Cells, ecosystems, genetics, and scientific observation.',
  },
  {
    code: 'AF-SEJ',
    name: 'Sejarah Indonesia',
    description: 'Indonesian history, source analysis, and civic identity.',
  },
  {
    code: 'AF-PPKN',
    name: 'Pendidikan Pancasila',
    description: 'Citizenship, constitution, rights, and responsibilities.',
  },
  {
    code: 'AF-PJOK',
    name: 'PJOK',
    description: 'Physical education, health, and team sports.',
  },
  {
    code: 'AF-SBD',
    name: 'Seni Budaya',
    description: 'Visual art, music appreciation, and creative practice.',
  },
] as const;

const TEACHERS = [
  {
    code: 'AF-MTK',
    email: 'ratih.prameswari@attendance-feature.seed',
    fullName: 'Ratih Prameswari',
    phone: '+628170010001',
    gender: 'female',
    birthPlace: 'Bandung',
    birthDate: '1984-02-12',
    employmentStatus: 'tetap',
  },
  {
    code: 'AF-BIN',
    email: 'dimas.hartono@attendance-feature.seed',
    fullName: 'Dimas Hartono',
    phone: '+628170010002',
    gender: 'male',
    birthPlace: 'Yogyakarta',
    birthDate: '1981-09-03',
    employmentStatus: 'pns',
  },
  {
    code: 'AF-ING',
    email: 'melissa.anggraini@attendance-feature.seed',
    fullName: 'Melissa Anggraini',
    phone: '+628170010003',
    gender: 'female',
    birthPlace: 'Jakarta',
    birthDate: '1988-11-18',
    employmentStatus: 'tetap',
  },
  {
    code: 'AF-FIS',
    email: 'arya.wibisana@attendance-feature.seed',
    fullName: 'Arya Wibisana',
    phone: '+628170010004',
    gender: 'male',
    birthPlace: 'Surabaya',
    birthDate: '1986-05-21',
    employmentStatus: 'tetap',
  },
  {
    code: 'AF-KIM',
    email: 'nurul.fitria@attendance-feature.seed',
    fullName: 'Nurul Fitria',
    phone: '+628170010005',
    gender: 'female',
    birthPlace: 'Malang',
    birthDate: '1990-01-09',
    employmentStatus: 'honorer',
  },
  {
    code: 'AF-BIO',
    email: 'bagas.pradipta@attendance-feature.seed',
    fullName: 'Bagas Pradipta',
    phone: '+628170010006',
    gender: 'male',
    birthPlace: 'Bogor',
    birthDate: '1987-06-27',
    employmentStatus: 'tetap',
  },
  {
    code: 'AF-SEJ',
    email: 'laila.nuraini@attendance-feature.seed',
    fullName: 'Laila Nuraini',
    phone: '+628170010007',
    gender: 'female',
    birthPlace: 'Solo',
    birthDate: '1983-12-11',
    employmentStatus: 'pns',
  },
  {
    code: 'AF-PPKN',
    email: 'hendro.saputra@attendance-feature.seed',
    fullName: 'Hendro Saputra',
    phone: '+628170010008',
    gender: 'male',
    birthPlace: 'Semarang',
    birthDate: '1982-04-16',
    employmentStatus: 'tetap',
  },
  {
    code: 'AF-PJOK',
    email: 'farid.maulana@attendance-feature.seed',
    fullName: 'Farid Maulana',
    phone: '+628170010009',
    gender: 'male',
    birthPlace: 'Bekasi',
    birthDate: '1989-08-08',
    employmentStatus: 'honorer',
  },
  {
    code: 'AF-SBD',
    email: 'cantika.salsabila@attendance-feature.seed',
    fullName: 'Cantika Salsabila',
    phone: '+628170010010',
    gender: 'female',
    birthPlace: 'Depok',
    birthDate: '1991-03-30',
    employmentStatus: 'tetap',
  },
] as const;

const ROOMS = [
  {
    name: 'AF Room 201',
    capacity: 32,
    description: 'Grade 10 Science Aurora homeroom.',
  },
  {
    name: 'AF Room 202',
    capacity: 32,
    description: 'Grade 10 Science Nusantara homeroom.',
  },
  {
    name: 'AF Science Lab',
    capacity: 28,
    description: 'Shared physics, chemistry, and biology laboratory.',
  },
  {
    name: 'AF Language Lab',
    capacity: 30,
    description: 'Language listening and speaking laboratory.',
  },
  {
    name: 'AF Sports Hall',
    capacity: 60,
    description: 'Indoor sports and health education space.',
  },
  {
    name: 'AF Art Studio',
    capacity: 28,
    description: 'Visual art and music practice studio.',
  },
] as const;

const PERIOD_ROWS = [
  { sortOrder: 1, kind: 'lesson', label: 'Period 1', durationMin: 45 },
  { sortOrder: 2, kind: 'lesson', label: 'Period 2', durationMin: 45 },
  { sortOrder: 3, kind: 'recess', label: 'Morning Break', durationMin: 15 },
  { sortOrder: 4, kind: 'lesson', label: 'Period 3', durationMin: 45 },
  { sortOrder: 5, kind: 'lesson', label: 'Period 4', durationMin: 45 },
  { sortOrder: 6, kind: 'break', label: 'Lunch Break', durationMin: 45 },
  { sortOrder: 7, kind: 'lesson', label: 'Period 5', durationMin: 45 },
  { sortOrder: 8, kind: 'lesson', label: 'Period 6', durationMin: 45 },
] as const;

const CLASSROOMS = [
  {
    key: 'aurora',
    name: 'X Science Aurora',
    gradeLevel: 10,
    room: 'AF Room 201',
    homeroomSubjectCode: 'AF-MTK',
  },
  {
    key: 'nusantara',
    name: 'X Science Nusantara',
    gradeLevel: 10,
    room: 'AF Room 202',
    homeroomSubjectCode: 'AF-BIN',
  },
] as const;

const STUDENTS = {
  aurora: [
    ['Aisha Putri Ramadhan', 'female'],
    ['Bima Aditya Nugroho', 'male'],
    ['Clara Nathania Wijaya', 'female'],
    ['Daffa Pranaja', 'male'],
    ['Elena Kartika Sari', 'female'],
    ['Fikri Alamsyah', 'male'],
    ['Gita Maharani', 'female'],
    ['Harris Wicaksono', 'male'],
    ['Intan Puspitasari', 'female'],
    ['Jovan Mahendra', 'male'],
    ['Kayla Safira', 'female'],
    ['Lukman Hakim', 'male'],
  ],
  nusantara: [
    ['Maya Kusumawardani', 'female'],
    ['Naufal Ibrahim', 'male'],
    ['Olivia Raharja', 'female'],
    ['Pramana Yudhistira', 'male'],
    ['Qisya Amalia', 'female'],
    ['Rafi Fadillah', 'male'],
    ['Salsa Nindya', 'female'],
    ['Tegar Bagaskara', 'male'],
    ['Utami Larasati', 'female'],
    ['Vino Prasetyo', 'male'],
    ['Wulan Cahyani', 'female'],
    ['Yusuf Ramadhan', 'male'],
  ],
} as const;

const TIMETABLE: Record<
  (typeof CLASSROOMS)[number]['key'],
  Array<{
    dayOfWeek: number;
    periodSortOrder: number;
    subjectCode: string;
    room: string;
    notes: string;
  }>
> = {
  aurora: [
    {
      dayOfWeek: 1,
      periodSortOrder: 1,
      subjectCode: 'AF-MTK',
      room: 'AF Room 201',
      notes: 'Core numeracy and problem solving',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 2,
      subjectCode: 'AF-BIN',
      room: 'AF Room 201',
      notes: 'Reading response workshop',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 4,
      subjectCode: 'AF-FIS',
      room: 'AF Science Lab',
      notes: 'Measurement and vectors lab',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 5,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Academic speaking practice',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 7,
      subjectCode: 'AF-SEJ',
      room: 'AF Room 201',
      notes: 'Historical source analysis',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 8,
      subjectCode: 'AF-PPKN',
      room: 'AF Room 201',
      notes: 'Civic discussion',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 1,
      subjectCode: 'AF-KIM',
      room: 'AF Science Lab',
      notes: 'Atomic structure',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 2,
      subjectCode: 'AF-MTK',
      room: 'AF Room 201',
      notes: 'Linear equations',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 4,
      subjectCode: 'AF-BIO',
      room: 'AF Science Lab',
      notes: 'Cell observation',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 5,
      subjectCode: 'AF-SBD',
      room: 'AF Art Studio',
      notes: 'Color composition',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 7,
      subjectCode: 'AF-PJOK',
      room: 'AF Sports Hall',
      notes: 'Fitness baseline',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 8,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Reading comprehension',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 1,
      subjectCode: 'AF-BIN',
      room: 'AF Room 201',
      notes: 'Expository writing',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 2,
      subjectCode: 'AF-FIS',
      room: 'AF Science Lab',
      notes: 'Motion graph practice',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 4,
      subjectCode: 'AF-MTK',
      room: 'AF Room 201',
      notes: 'Quadratic functions',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 5,
      subjectCode: 'AF-KIM',
      room: 'AF Science Lab',
      notes: 'Bonding models',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 7,
      subjectCode: 'AF-PPKN',
      room: 'AF Room 201',
      notes: 'Constitution case study',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 8,
      subjectCode: 'AF-BIO',
      room: 'AF Science Lab',
      notes: 'Microscope practice',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 1,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Listening lab',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 2,
      subjectCode: 'AF-MTK',
      room: 'AF Room 201',
      notes: 'Statistics',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 4,
      subjectCode: 'AF-BIN',
      room: 'AF Room 201',
      notes: 'Literature circle',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 5,
      subjectCode: 'AF-SEJ',
      room: 'AF Room 201',
      notes: 'Timeline project',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 7,
      subjectCode: 'AF-FIS',
      room: 'AF Science Lab',
      notes: 'Forces and friction',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 8,
      subjectCode: 'AF-SBD',
      room: 'AF Art Studio',
      notes: 'Music ensemble',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 1,
      subjectCode: 'AF-PJOK',
      room: 'AF Sports Hall',
      notes: 'Team sports',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 2,
      subjectCode: 'AF-KIM',
      room: 'AF Science Lab',
      notes: 'Chemical equations',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 4,
      subjectCode: 'AF-BIO',
      room: 'AF Science Lab',
      notes: 'Ecosystem mapping',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 5,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Writing clinic',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 7,
      subjectCode: 'AF-MTK',
      room: 'AF Room 201',
      notes: 'Weekly problem set',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 8,
      subjectCode: 'AF-BIN',
      room: 'AF Room 201',
      notes: 'Reflection journal',
    },
  ],
  nusantara: [
    {
      dayOfWeek: 1,
      periodSortOrder: 1,
      subjectCode: 'AF-BIN',
      room: 'AF Room 202',
      notes: 'Reading response workshop',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 2,
      subjectCode: 'AF-MTK',
      room: 'AF Room 202',
      notes: 'Core numeracy and problem solving',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 4,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Academic speaking practice',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 5,
      subjectCode: 'AF-FIS',
      room: 'AF Science Lab',
      notes: 'Measurement and vectors lab',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 7,
      subjectCode: 'AF-PPKN',
      room: 'AF Room 202',
      notes: 'Civic discussion',
    },
    {
      dayOfWeek: 1,
      periodSortOrder: 8,
      subjectCode: 'AF-SEJ',
      room: 'AF Room 202',
      notes: 'Historical source analysis',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 1,
      subjectCode: 'AF-MTK',
      room: 'AF Room 202',
      notes: 'Linear equations',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 2,
      subjectCode: 'AF-KIM',
      room: 'AF Science Lab',
      notes: 'Atomic structure',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 4,
      subjectCode: 'AF-SBD',
      room: 'AF Art Studio',
      notes: 'Color composition',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 5,
      subjectCode: 'AF-BIO',
      room: 'AF Science Lab',
      notes: 'Cell observation',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 7,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Reading comprehension',
    },
    {
      dayOfWeek: 2,
      periodSortOrder: 8,
      subjectCode: 'AF-PJOK',
      room: 'AF Sports Hall',
      notes: 'Fitness baseline',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 1,
      subjectCode: 'AF-FIS',
      room: 'AF Science Lab',
      notes: 'Motion graph practice',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 2,
      subjectCode: 'AF-BIN',
      room: 'AF Room 202',
      notes: 'Expository writing',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 4,
      subjectCode: 'AF-KIM',
      room: 'AF Science Lab',
      notes: 'Bonding models',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 5,
      subjectCode: 'AF-MTK',
      room: 'AF Room 202',
      notes: 'Quadratic functions',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 7,
      subjectCode: 'AF-BIO',
      room: 'AF Science Lab',
      notes: 'Microscope practice',
    },
    {
      dayOfWeek: 3,
      periodSortOrder: 8,
      subjectCode: 'AF-PPKN',
      room: 'AF Room 202',
      notes: 'Constitution case study',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 1,
      subjectCode: 'AF-MTK',
      room: 'AF Room 202',
      notes: 'Statistics',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 2,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Listening lab',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 4,
      subjectCode: 'AF-SEJ',
      room: 'AF Room 202',
      notes: 'Timeline project',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 5,
      subjectCode: 'AF-BIN',
      room: 'AF Room 202',
      notes: 'Literature circle',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 7,
      subjectCode: 'AF-SBD',
      room: 'AF Art Studio',
      notes: 'Music ensemble',
    },
    {
      dayOfWeek: 4,
      periodSortOrder: 8,
      subjectCode: 'AF-FIS',
      room: 'AF Science Lab',
      notes: 'Forces and friction',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 1,
      subjectCode: 'AF-KIM',
      room: 'AF Science Lab',
      notes: 'Chemical equations',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 2,
      subjectCode: 'AF-PJOK',
      room: 'AF Sports Hall',
      notes: 'Team sports',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 4,
      subjectCode: 'AF-ING',
      room: 'AF Language Lab',
      notes: 'Writing clinic',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 5,
      subjectCode: 'AF-BIO',
      room: 'AF Science Lab',
      notes: 'Ecosystem mapping',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 7,
      subjectCode: 'AF-BIN',
      room: 'AF Room 202',
      notes: 'Reflection journal',
    },
    {
      dayOfWeek: 5,
      periodSortOrder: 8,
      subjectCode: 'AF-MTK',
      room: 'AF Room 202',
      notes: 'Weekly problem set',
    },
  ],
};

function log(message: string) {
  console.log(`[attendance-feature:${schema}] ${message}`);
}

function dateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function hash(input: string) {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

function pickStatus(seed: string): AttendanceStatus {
  const bucket = hash(seed) % 100;
  if (bucket < 84) return 'present';
  if (bucket < 91) return 'late';
  if (bucket < 95) return 'sick';
  if (bucket < 98) return 'excused';
  return 'absent';
}

function statusNotes(status: AttendanceStatus) {
  switch (status) {
    case 'late':
      return 'Late arrival recorded at gate check-in';
    case 'sick':
      return 'Parent notified school that student was sick';
    case 'excused':
      return 'Excused for approved family or school activity';
    case 'absent':
      return 'Absent without confirmation at attendance cutoff';
    default:
      return null;
  }
}

function lateMinutes(seed: string) {
  return 5 + (hash(seed) % 4) * 5;
}

async function ensureSchema(targetSchema: string) {
  await PUBLIC_PRISMA.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`,
  );
}

async function upsertUser(
  db: TenantClient,
  data: {
    email?: string;
    username?: string;
    fullName: string;
    role: 'school_admin' | 'principal' | 'teacher' | 'student' | 'parent';
  },
  passwordHash: string,
) {
  const existing = await db.user.findFirst({
    where: data.email ? { email: data.email } : { username: data.username! },
  });

  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        fullName: data.fullName,
        role: data.role,
        status: 'active',
        deletedAt: null,
      },
    });
  }

  return db.user.create({
    data: {
      email: data.email,
      username: data.username,
      fullName: data.fullName,
      role: data.role,
      status: 'active',
      passwordHash,
    },
  });
}

async function ensureSubject(
  db: TenantClient,
  subject: (typeof SUBJECTS)[number],
) {
  const existing = await db.subject.findFirst({
    where: { code: subject.code, deletedAt: null },
  });
  if (existing) {
    return db.subject.update({
      where: { id: existing.id },
      data: {
        name: subject.name,
        description: subject.description,
        deletedAt: null,
      },
    });
  }

  return db.subject.create({ data: subject });
}

async function ensureSingleActiveEnrollment(
  db: TenantClient,
  studentProfileId: string,
  classroomId: string,
  academicYearId: string,
) {
  await db.enrollment.updateMany({
    where: {
      studentProfileId,
      status: 'active',
      classroomId: { not: classroomId },
      classroom: { academicYearId },
    },
    data: { status: 'transferred' },
  });

  const existing = await db.enrollment.findUnique({
    where: {
      studentProfileId_classroomId: { studentProfileId, classroomId },
    },
  });

  if (existing) {
    await db.enrollment.update({
      where: { id: existing.id },
      data: { status: 'active' },
    });
    return;
  }

  await db.enrollment.create({
    data: { studentProfileId, classroomId, status: 'active' },
  });
}

async function main() {
  await ensureSchema(schema);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  log('Seeding realistic attendance feature data');

  await upsertUser(
    prisma,
    {
      email: 'principal.maya@attendance-feature.seed',
      fullName: 'Maya Sekar Arum',
      role: 'principal',
    },
    passwordHash,
  );
  await upsertUser(
    prisma,
    {
      email: 'school.admin@attendance-feature.seed',
      fullName: 'Rendra Kurniawan',
      role: 'school_admin',
    },
    passwordHash,
  );

  const academicYear = await prisma.academicYear.upsert({
    where: { label_semester: { label: '2025/2026', semester: 2 } },
    create: {
      label: '2025/2026',
      semester: 2,
      startDate: dateOnly('2026-01-05'),
      endDate: dateOnly('2026-06-19'),
      isActive: true,
    },
    update: {
      startDate: dateOnly('2026-01-05'),
      endDate: dateOnly('2026-06-19'),
      isActive: true,
    },
  });

  await prisma.academicYear.updateMany({
    where: {
      id: { not: academicYear.id },
      isActive: true,
    },
    data: { isActive: false },
  });

  const subjectMap = new Map<
    string,
    { id: string; name: string; code: string | null }
  >();
  for (const subject of SUBJECTS) {
    const row = await ensureSubject(prisma, subject);
    subjectMap.set(subject.code, row);
  }

  const roomMap = new Map<string, { id: string; name: string }>();
  for (const room of ROOMS) {
    const row = await prisma.room.upsert({
      where: { name: room.name },
      create: room,
      update: {
        capacity: room.capacity,
        description: room.description,
        deletedAt: null,
      },
    });
    roomMap.set(room.name, row);
  }

  const periodTemplate = await prisma.periodTemplate.upsert({
    where: {
      gradeLevel_academicYearId: {
        gradeLevel: 10,
        academicYearId: academicYear.id,
      },
    },
    create: {
      gradeLevel: 10,
      academicYearId: academicYear.id,
      dayStart: '07:00',
    },
    update: { dayStart: '07:00' },
  });

  const periodRows = new Map<
    number,
    { id: string; sortOrder: number; kind: string; label: string }
  >();
  for (const row of PERIOD_ROWS) {
    const periodRow = await prisma.periodRow.upsert({
      where: {
        templateId_sortOrder: {
          templateId: periodTemplate.id,
          sortOrder: row.sortOrder,
        },
      },
      create: {
        templateId: periodTemplate.id,
        sortOrder: row.sortOrder,
        kind: row.kind as any,
        label: row.label,
        durationMin: row.durationMin,
        activeDays: [1, 2, 3, 4, 5],
      },
      update: {
        kind: row.kind as any,
        label: row.label,
        durationMin: row.durationMin,
        activeDays: [1, 2, 3, 4, 5],
      },
    });
    periodRows.set(row.sortOrder, periodRow);
  }

  const teacherMap = new Map<
    string,
    { profileId: string; userId: string; fullName: string }
  >();
  for (const teacher of TEACHERS) {
    const user = await upsertUser(
      prisma,
      {
        email: teacher.email,
        fullName: teacher.fullName,
        role: 'teacher',
      },
      passwordHash,
    );

    const existingProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });

    const profile = existingProfile
      ? await prisma.teacherProfile.update({
          where: { id: existingProfile.id },
          data: {
            email: teacher.email,
            phone: teacher.phone,
            gender: teacher.gender as any,
            birthPlace: teacher.birthPlace,
            birthDate: dateOnly(teacher.birthDate),
            employmentStatus: teacher.employmentStatus as any,
            bio: `${teacher.fullName} teaches ${subjectMap.get(teacher.code)!.name} for the attendance feature fixture.`,
            status: 'active',
            deletedAt: null,
          },
        })
      : await prisma.teacherProfile.create({
          data: {
            userId: user.id,
            email: teacher.email,
            phone: teacher.phone,
            gender: teacher.gender as any,
            birthPlace: teacher.birthPlace,
            birthDate: dateOnly(teacher.birthDate),
            employmentStatus: teacher.employmentStatus as any,
            bio: `${teacher.fullName} teaches ${subjectMap.get(teacher.code)!.name} for the attendance feature fixture.`,
            status: 'active',
          },
        });

    teacherMap.set(teacher.code, {
      profileId: profile.id,
      userId: user.id,
      fullName: teacher.fullName,
    });
  }

  const classroomMap = new Map<
    string,
    {
      id: string;
      name: string;
      gradeLevel: number;
      homeroomUserId: string;
      homeroomProfileId: string;
    }
  >();

  for (const fixture of CLASSROOMS) {
    const homeroom = teacherMap.get(fixture.homeroomSubjectCode)!;
    const classroom = await prisma.classroom.upsert({
      where: {
        name_academicYearId: {
          name: fixture.name,
          academicYearId: academicYear.id,
        },
      },
      create: {
        name: fixture.name,
        gradeLevel: fixture.gradeLevel,
        academicYearId: academicYear.id,
        homeroomUserId: homeroom.userId,
      },
      update: {
        gradeLevel: fixture.gradeLevel,
        homeroomUserId: homeroom.userId,
        deletedAt: null,
      },
    });

    const existingAssignment = await prisma.homeroomAssignment.findFirst({
      where: {
        classroomId: classroom.id,
        academicYearId: academicYear.id,
        isActive: true,
        deletedAt: null,
      },
    });

    if (existingAssignment) {
      await prisma.homeroomAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          teacherProfileId: homeroom.profileId,
          notes: `Homeroom teacher for ${fixture.name}`,
          endedAt: null,
        },
      });
    } else {
      await prisma.homeroomAssignment.create({
        data: {
          classroomId: classroom.id,
          academicYearId: academicYear.id,
          teacherProfileId: homeroom.profileId,
          notes: `Homeroom teacher for ${fixture.name}`,
        },
      });
    }

    classroomMap.set(fixture.key, {
      id: classroom.id,
      name: classroom.name,
      gradeLevel: classroom.gradeLevel,
      homeroomUserId: homeroom.userId,
      homeroomProfileId: homeroom.profileId,
    });
  }

  for (const fixture of CLASSROOMS) {
    const classroom = classroomMap.get(fixture.key)!;
    const subjectCounts = new Map<string, number>();
    for (const entry of TIMETABLE[fixture.key]) {
      subjectCounts.set(
        entry.subjectCode,
        (subjectCounts.get(entry.subjectCode) ?? 0) + 1,
      );
    }

    for (const subject of SUBJECTS) {
      const teacher = teacherMap.get(subject.code)!;
      const subjectRow = subjectMap.get(subject.code)!;
      const defaultRoom =
        subject.code === 'AF-FIS' ||
        subject.code === 'AF-KIM' ||
        subject.code === 'AF-BIO'
          ? 'AF Science Lab'
          : subject.code === 'AF-ING'
            ? 'AF Language Lab'
            : subject.code === 'AF-PJOK'
              ? 'AF Sports Hall'
              : subject.code === 'AF-SBD'
                ? 'AF Art Studio'
                : fixture.room;

      await prisma.classSubject.upsert({
        where: {
          classroomId_subjectId: {
            classroomId: classroom.id,
            subjectId: subjectRow.id,
          },
        },
        create: {
          classroomId: classroom.id,
          subjectId: subjectRow.id,
          teacherProfileId: teacher.profileId,
        },
        update: { teacherProfileId: teacher.profileId },
      });

      const existingRequirement = await prisma.scheduleRequirement.findFirst({
        where: {
          classroomId: classroom.id,
          subjectId: subjectRow.id,
          academicYearId: academicYear.id,
        },
      });

      if (existingRequirement) {
        await prisma.scheduleRequirement.update({
          where: { id: existingRequirement.id },
          data: {
            teacherProfileId: teacher.profileId,
            roomId: roomMap.get(defaultRoom)!.id,
            sessionsPerWeek: subjectCounts.get(subject.code) ?? 0,
          },
        });
      } else {
        await prisma.scheduleRequirement.create({
          data: {
            classroomId: classroom.id,
            subjectId: subjectRow.id,
            teacherProfileId: teacher.profileId,
            roomId: roomMap.get(defaultRoom)!.id,
            sessionsPerWeek: subjectCounts.get(subject.code) ?? 0,
            academicYearId: academicYear.id,
          },
        });
      }
    }
  }

  const studentRows: Array<{
    id: string;
    userId: string;
    fullName: string;
    classroomId: string;
    classroomKey: (typeof CLASSROOMS)[number]['key'];
  }> = [];

  for (const fixture of CLASSROOMS) {
    const classroom = classroomMap.get(fixture.key)!;
    const students = STUDENTS[fixture.key];

    for (let i = 0; i < students.length; i += 1) {
      const [fullName, gender] = students[i];
      const number = i + 1;
      const username = `af-${fixture.key}-${number.toString().padStart(2, '0')}`;
      const user = await upsertUser(
        prisma,
        {
          username,
          fullName,
          role: 'student',
        },
        passwordHash,
      );

      const nisn = `2026${fixture.key === 'aurora' ? '10' : '20'}${number.toString().padStart(4, '0')}`;
      const nik = `3276${fixture.key === 'aurora' ? '10' : '20'}2026${number.toString().padStart(4, '0')}`;
      const existingProfile = await prisma.studentProfile.findUnique({
        where: { userId: user.id },
      });

      const profile = existingProfile
        ? await prisma.studentProfile.update({
            where: { id: existingProfile.id },
            data: {
              nisn,
              nik,
              gender: gender as any,
              religion: 'Islam',
              phone: `+6281800${fixture.key === 'aurora' ? '10' : '20'}${number.toString().padStart(3, '0')}`,
              birthDate: dateOnly(
                `2010-${((number % 9) + 1).toString().padStart(2, '0')}-15`,
              ),
              birthPlace: number % 2 === 0 ? 'Jakarta' : 'Bekasi',
              entryYear: 2025,
              address: `${fixture.name} Student Residence Block ${number}`,
              status: 'active',
            },
          })
        : await prisma.studentProfile.create({
            data: {
              userId: user.id,
              nisn,
              nik,
              gender: gender as any,
              religion: 'Islam',
              phone: `+6281800${fixture.key === 'aurora' ? '10' : '20'}${number.toString().padStart(3, '0')}`,
              birthDate: dateOnly(
                `2010-${((number % 9) + 1).toString().padStart(2, '0')}-15`,
              ),
              birthPlace: number % 2 === 0 ? 'Jakarta' : 'Bekasi',
              entryYear: 2025,
              address: `${fixture.name} Student Residence Block ${number}`,
              status: 'active',
            },
          });

      await ensureSingleActiveEnrollment(
        prisma,
        profile.id,
        classroom.id,
        academicYear.id,
      );

      const parentName = `Parent of ${fullName}`;
      const parentUser = await upsertUser(
        prisma,
        {
          email: `${username}.parent@attendance-feature.seed`,
          fullName: parentName,
          role: 'parent',
        },
        passwordHash,
      );

      const guardian = await prisma.guardian.findFirst({
        where: {
          studentProfileId: profile.id,
          name: parentName,
        },
      });

      if (guardian) {
        await prisma.guardian.update({
          where: { id: guardian.id },
          data: {
            userId: parentUser.id,
            relationship: 'parent',
            phone: `+6281900${fixture.key === 'aurora' ? '10' : '20'}${number.toString().padStart(3, '0')}`,
            email: `${username}.parent@attendance-feature.seed`,
            isPrimary: true,
          },
        });
      } else {
        await prisma.guardian.create({
          data: {
            studentProfileId: profile.id,
            userId: parentUser.id,
            name: parentName,
            relationship: 'parent',
            phone: `+6281900${fixture.key === 'aurora' ? '10' : '20'}${number.toString().padStart(3, '0')}`,
            email: `${username}.parent@attendance-feature.seed`,
            address: `${fixture.name} Parent Residence Block ${number}`,
            isPrimary: true,
          },
        });
      }

      studentRows.push({
        id: profile.id,
        userId: user.id,
        fullName,
        classroomId: classroom.id,
        classroomKey: fixture.key,
      });
    }
  }

  const scheduleEntryByClassroomDay = new Map<
    string,
    Array<{ id: string; subjectCode: string; teacherUserId: string }>
  >();

  for (const fixture of CLASSROOMS) {
    const classroom = classroomMap.get(fixture.key)!;
    const schedule = await prisma.schedule.upsert({
      where: {
        classroomId_academicYearId: {
          classroomId: classroom.id,
          academicYearId: academicYear.id,
        },
      },
      create: {
        classroomId: classroom.id,
        academicYearId: academicYear.id,
        status: 'published',
        publishedAt: new Date(),
      },
      update: {
        status: 'published',
        publishedAt: new Date(),
        archivedAt: null,
        deletedAt: null,
      },
    });

    for (const entry of TIMETABLE[fixture.key]) {
      const subject = subjectMap.get(entry.subjectCode)!;
      const teacher = teacherMap.get(entry.subjectCode)!;
      const periodRow = periodRows.get(entry.periodSortOrder)!;
      const room = roomMap.get(entry.room)!;

      const existing = await prisma.scheduleEntry.findFirst({
        where: {
          scheduleId: schedule.id,
          subjectId: subject.id,
          dayOfWeek: entry.dayOfWeek,
          periodRowId: periodRow.id,
          deletedAt: null,
        },
      });

      const scheduleEntry = existing
        ? await prisma.scheduleEntry.update({
            where: { id: existing.id },
            data: {
              teacherProfileId: teacher.profileId,
              roomId: room.id,
              notes: entry.notes,
              deletedAt: null,
            },
          })
        : await prisma.scheduleEntry.create({
            data: {
              scheduleId: schedule.id,
              subjectId: subject.id,
              teacherProfileId: teacher.profileId,
              roomId: room.id,
              dayOfWeek: entry.dayOfWeek,
              periodRowId: periodRow.id,
              notes: entry.notes,
            },
          });

      const key = `${fixture.key}:${entry.dayOfWeek}`;
      const rows = scheduleEntryByClassroomDay.get(key) ?? [];
      rows.push({
        id: scheduleEntry.id,
        subjectCode: entry.subjectCode,
        teacherUserId: teacher.userId,
      });
      scheduleEntryByClassroomDay.set(key, rows);
    }
  }

  const attendanceDates = [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-08',
    '2026-06-09',
    '2026-06-10',
  ].map(dateOnly);

  for (const student of studentRows) {
    const classroom = classroomMap.get(student.classroomKey)!;

    for (const attendanceDate of attendanceDates) {
      const isoDay =
        attendanceDate.getUTCDay() === 0 ? 7 : attendanceDate.getUTCDay();
      const dateKey = attendanceDate.toISOString().slice(0, 10);
      const homeroomStatus = pickStatus(
        `${student.fullName}:${dateKey}:homeroom`,
      );
      const existingHomeroom = await prisma.attendanceRecord.findFirst({
        where: {
          studentProfileId: student.id,
          classroomId: student.classroomId,
          academicYearId: academicYear.id,
          attendanceDate,
          scheduleEntryId: null,
          deletedAt: null,
        },
      });

      const homeroomData = {
        status: homeroomStatus as any,
        lateMinutes:
          homeroomStatus === 'late'
            ? lateMinutes(`${student.fullName}:${dateKey}:homeroom`)
            : null,
        notes: statusNotes(homeroomStatus),
        markedByUserId: classroom.homeroomUserId,
        updatedByUserId: null,
        updateReason: null,
        deletedAt: null,
      };

      if (existingHomeroom) {
        await prisma.attendanceRecord.update({
          where: { id: existingHomeroom.id },
          data: homeroomData,
        });
      } else {
        await prisma.attendanceRecord.create({
          data: {
            studentProfileId: student.id,
            classroomId: student.classroomId,
            academicYearId: academicYear.id,
            attendanceDate,
            scheduleEntryId: null,
            ...homeroomData,
          },
        });
      }

      const dayEntries =
        scheduleEntryByClassroomDay.get(`${student.classroomKey}:${isoDay}`) ??
        [];
      for (const entry of dayEntries) {
        const status = pickStatus(
          `${student.fullName}:${dateKey}:${entry.subjectCode}`,
        );
        const existingSubject = await prisma.attendanceRecord.findFirst({
          where: {
            studentProfileId: student.id,
            classroomId: student.classroomId,
            academicYearId: academicYear.id,
            attendanceDate,
            scheduleEntryId: entry.id,
            deletedAt: null,
          },
        });

        const data = {
          status: status as any,
          lateMinutes:
            status === 'late'
              ? lateMinutes(
                  `${student.fullName}:${dateKey}:${entry.subjectCode}`,
                )
              : null,
          notes: statusNotes(status),
          markedByUserId: entry.teacherUserId,
          updatedByUserId: null,
          updateReason: null,
          deletedAt: null,
        };

        if (existingSubject) {
          await prisma.attendanceRecord.update({
            where: { id: existingSubject.id },
            data,
          });
        } else {
          await prisma.attendanceRecord.create({
            data: {
              studentProfileId: student.id,
              classroomId: student.classroomId,
              academicYearId: academicYear.id,
              attendanceDate,
              scheduleEntryId: entry.id,
              ...data,
            },
          });
        }
      }
    }
  }

  log(
    `Seeded ${CLASSROOMS.length} classes, ${SUBJECTS.length} subjects, ${TEACHERS.length} teachers, ${studentRows.length} students`,
  );
  log(`Password for seeded users: ${PASSWORD}`);
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
