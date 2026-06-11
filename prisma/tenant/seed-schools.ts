/**
 * Multi-school tenant seed for tenant_school_1 and tenant_school_2.
 *
 * Usage:
 *   npx ts-node --project tsconfig.seed.json prisma/tenant/seed-schools.ts
 *   SEED_SCHEMA=tenant_school_1 npx ts-node --project tsconfig.seed.json prisma/tenant/seed-schools.ts
 *
 * It is idempotent and seeds two isolated tenant schemas with different quality profiles:
 * - tenant_school_1: stronger academics, cleaner attendance, more awards
 * - tenant_school_2: decent but weaker attendance and fewer achievements
 */

import { PrismaClient as PublicPrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '../../src/generated/tenant-client';
import { tenantSeedUrl } from './seed-url';
import * as bcrypt from 'bcrypt';

type AttendanceStatus = 'present' | 'late' | 'excused' | 'sick' | 'absent';

type SchoolConfig = {
  schema: string;
  profile: 'strong' | 'growth';
  label: string;
  story: string;
  password: string;
  attendanceWeights: Record<AttendanceStatus, number>;
  scheduleStatuses: Array<'draft' | 'published'>;
  teachers: Array<{
    email: string;
    fullName: string;
    phone: string;
    birthDate: string;
    birthPlace: string;
    employmentStatus: 'pns' | 'p3k' | 'tetap' | 'honorer';
    subjectCode: string;
  }>;
  students: Array<{
    username: string;
    fullName: string;
    nisn: string;
    nik: string;
    gender: 'male' | 'female';
    religion: string;
    phone: string;
    birthDate: string;
    birthPlace: string;
    entryYear: number;
    address: string;
    parentName: string;
    parentPhone: string;
    parentEmail?: string | null;
  }>;
};

const PUBLIC_PRISMA = new PublicPrismaClient();

const SUBJECTS = [
  {
    code: 'MTK',
    name: 'Matematika',
    description: 'Mata pelajaran inti numerik dan logika.',
  },
  {
    code: 'BIN',
    name: 'Bahasa Indonesia',
    description: 'Literasi, bahasa, dan komunikasi.',
  },
  {
    code: 'FIS',
    name: 'Fisika',
    description: 'Eksperimen, teori, dan problem solving.',
  },
  {
    code: 'KIM',
    name: 'Kimia',
    description: 'Struktur materi dan reaksi kimia.',
  },
  {
    code: 'INF',
    name: 'Informatika',
    description: 'Pemrograman dan teknologi digital.',
  },
  {
    code: 'ING',
    name: 'Bahasa Inggris',
    description: 'Kompetensi reading, writing, speaking.',
  },
] as const;

const ROOM_DATA = [
  { name: 'Ruang 101', capacity: 36, description: 'Ruang kelas utama.' },
  { name: 'Ruang 102', capacity: 36, description: 'Ruang kelas cadangan.' },
  { name: 'Lab Sains', capacity: 24, description: 'Laboratorium praktikum.' },
] as const;

const PERIOD_ROWS = [
  { sortOrder: 1, kind: 'lesson', label: 'Period 1', durationMin: 45 },
  { sortOrder: 2, kind: 'lesson', label: 'Period 2', durationMin: 45 },
  { sortOrder: 3, kind: 'break', label: 'Morning Break', durationMin: 15 },
  { sortOrder: 4, kind: 'lesson', label: 'Period 3', durationMin: 45 },
  { sortOrder: 5, kind: 'lesson', label: 'Period 4', durationMin: 45 },
] as const;

const SCHOOL_CONFIGS: SchoolConfig[] = [
  {
    schema: 'tenant_school_1',
    profile: 'strong',
    label: 'SMA Harmoni Cendekia',
    story:
      'Top-performing science-oriented branch. Attendance is disciplined, schedules are mostly published, and students are active in science, debate, and robotics activities.',
    password: 'password123',
    attendanceWeights: { present: 88, late: 7, excused: 2, sick: 2, absent: 1 },
    scheduleStatuses: ['published', 'published'],
    teachers: [
      {
        email: 'budi.santoso@school1.demo',
        fullName: 'Budi Santoso',
        phone: '+628111100001',
        birthDate: '1985-03-10',
        birthPlace: 'Bandung',
        employmentStatus: 'pns',
        subjectCode: 'MTK',
      },
      {
        email: 'siti.rahayu@school1.demo',
        fullName: 'Siti Rahayu',
        phone: '+628111100002',
        birthDate: '1988-07-22',
        birthPlace: 'Jakarta',
        employmentStatus: 'tetap',
        subjectCode: 'BIN',
      },
      {
        email: 'ahmad.fauzi@school1.demo',
        fullName: 'Ahmad Fauzi',
        phone: '+628111100003',
        birthDate: '1990-01-15',
        birthPlace: 'Surabaya',
        employmentStatus: 'honorer',
        subjectCode: 'FIS',
      },
      {
        email: 'dewi.lestari@school1.demo',
        fullName: 'Dewi Lestari',
        phone: '+628111100004',
        birthDate: '1987-11-05',
        birthPlace: 'Medan',
        employmentStatus: 'p3k',
        subjectCode: 'KIM',
      },
      {
        email: 'rudi.hermawan@school1.demo',
        fullName: 'Rudi Hermawan',
        phone: '+628111100005',
        birthDate: '1982-06-30',
        birthPlace: 'Yogyakarta',
        employmentStatus: 'pns',
        subjectCode: 'INF',
      },
    ],
    students: [
      {
        username: 'andi.pratama',
        fullName: 'Andi Pratama',
        nisn: '0111100001',
        nik: '3201010101081001',
        gender: 'male',
        religion: 'Islam',
        phone: '+628211100001',
        birthDate: '2008-04-12',
        birthPlace: 'Bandung',
        entryYear: 2025,
        address: 'Jl. Merdeka No. 1, Bandung',
        parentName: 'Hendra Pratama',
        parentPhone: '+628120000001',
        parentEmail: 'hendra.pratama@example.com',
      },
      {
        username: 'sari.dewi',
        fullName: 'Sari Dewi',
        nisn: '0111100002',
        nik: '3201010101081002',
        gender: 'female',
        religion: 'Islam',
        phone: '+628211100002',
        birthDate: '2008-08-25',
        birthPlace: 'Jakarta',
        entryYear: 2025,
        address: 'Jl. Sudirman No. 45, Jakarta',
        parentName: 'Budi Dewi',
        parentPhone: '+628120000002',
        parentEmail: 'budi.dewi@example.com',
      },
      {
        username: 'bima.kurniawan',
        fullName: 'Bima Kurniawan',
        nisn: '0111100003',
        nik: '3201010101081003',
        gender: 'male',
        religion: 'Kristen',
        phone: '+628211100003',
        birthDate: '2008-02-14',
        birthPlace: 'Medan',
        entryYear: 2025,
        address: 'Jl. Pahlawan No. 12, Medan',
        parentName: 'Susanto Kurniawan',
        parentPhone: '+628120000003',
        parentEmail: null,
      },
      {
        username: 'rina.susanti',
        fullName: 'Rina Susanti',
        nisn: '0111100004',
        nik: '3201010101081004',
        gender: 'female',
        religion: 'Katolik',
        phone: '+628211100004',
        birthDate: '2008-11-03',
        birthPlace: 'Surabaya',
        entryYear: 2025,
        address: 'Jl. Ahmad Yani No. 67, Surabaya',
        parentName: 'Agus Susanti',
        parentPhone: '+628120000004',
        parentEmail: 'agus.susanti@example.com',
      },
      {
        username: 'doni.saputra',
        fullName: 'Doni Saputra',
        nisn: '0111100005',
        nik: '3201010101081005',
        gender: 'male',
        religion: 'Islam',
        phone: '+628211100005',
        birthDate: '2008-06-19',
        birthPlace: 'Yogyakarta',
        entryYear: 2025,
        address: 'Jl. Malioboro No. 100, Yogyakarta',
        parentName: 'Widi Saputra',
        parentPhone: '+628120000005',
        parentEmail: null,
      },
      {
        username: 'maya.indah',
        fullName: 'Maya Indah Lestari',
        nisn: '0111100006',
        nik: '3201010101081006',
        gender: 'female',
        religion: 'Islam',
        phone: '+628211100006',
        birthDate: '2008-09-30',
        birthPlace: 'Semarang',
        entryYear: 2025,
        address: 'Jl. Pemuda No. 23, Semarang',
        parentName: 'Tono Lestari',
        parentPhone: '+628120000006',
        parentEmail: 'tono.lestari@example.com',
      },
      {
        username: 'fajar.nugraha',
        fullName: 'Fajar Nugraha',
        nisn: '0111100007',
        nik: '3201010101081007',
        gender: 'male',
        religion: 'Islam',
        phone: '+628211100007',
        birthDate: '2008-01-07',
        birthPlace: 'Bogor',
        entryYear: 2025,
        address: 'Jl. Raya Bogor No. 5, Bogor',
        parentName: 'Irwan Nugraha',
        parentPhone: '+628120000007',
        parentEmail: null,
      },
      {
        username: 'lina.marlena',
        fullName: 'Lina Marlena',
        nisn: '0111100008',
        nik: '3201010101081008',
        gender: 'female',
        religion: 'Kristen',
        phone: '+628211100008',
        birthDate: '2008-05-22',
        birthPlace: 'Makassar',
        entryYear: 2025,
        address: 'Jl. Veteran No. 89, Makassar',
        parentName: 'Hendri Marlena',
        parentPhone: '+628120000008',
        parentEmail: 'hendri.marlena@example.com',
      },
    ],
  },
  {
    schema: 'tenant_school_2',
    profile: 'growth',
    label: 'SMA Harmoni Mandiri',
    story:
      'Growing branch with a few operational gaps. Attendance is less stable, one timetable is still draft, and students have fewer high-level achievements.',
    password: 'password123',
    attendanceWeights: { present: 78, late: 8, excused: 5, sick: 4, absent: 5 },
    scheduleStatuses: ['draft', 'published'],
    teachers: [
      {
        email: 'nia.wulandari@school2.demo',
        fullName: 'Nia Wulandari',
        phone: '+628211200001',
        birthDate: '1986-02-20',
        birthPlace: 'Solo',
        employmentStatus: 'tetap',
        subjectCode: 'MTK',
      },
      {
        email: 'hasan.maulana@school2.demo',
        fullName: 'Hasan Maulana',
        phone: '+628211200002',
        birthDate: '1984-10-12',
        birthPlace: 'Tasikmalaya',
        employmentStatus: 'p3k',
        subjectCode: 'BIN',
      },
      {
        email: 'putri.azzahra@school2.demo',
        fullName: 'Putri Azzahra',
        phone: '+628211200003',
        birthDate: '1991-05-02',
        birthPlace: 'Cirebon',
        employmentStatus: 'honorer',
        subjectCode: 'FIS',
      },
      {
        email: 'yudha.pratama@school2.demo',
        fullName: 'Yudha Pratama',
        phone: '+628211200004',
        birthDate: '1989-12-09',
        birthPlace: 'Bekasi',
        employmentStatus: 'tetap',
        subjectCode: 'KIM',
      },
      {
        email: 'mira.anggraini@school2.demo',
        fullName: 'Mira Anggraini',
        phone: '+628211200005',
        birthDate: '1988-04-18',
        birthPlace: 'Depok',
        employmentStatus: 'p3k',
        subjectCode: 'INF',
      },
    ],
    students: [
      {
        username: 'reza.hakim',
        fullName: 'Reza Hakim',
        nisn: '0222200001',
        nik: '3201010102082001',
        gender: 'male',
        religion: 'Islam',
        phone: '+628221200001',
        birthDate: '2008-10-13',
        birthPlace: 'Solo',
        entryYear: 2025,
        address: 'Jl. Slamet Riyadi No. 11, Solo',
        parentName: 'Agung Hakim',
        parentPhone: '+628130000001',
        parentEmail: 'agung.hakim@example.com',
      },
      {
        username: 'nabila.safira',
        fullName: 'Nabila Safira',
        nisn: '0222200002',
        nik: '3201010102082002',
        gender: 'female',
        religion: 'Islam',
        phone: '+628221200002',
        birthDate: '2008-06-17',
        birthPlace: 'Bandung',
        entryYear: 2025,
        address: 'Jl. Asia Afrika No. 22, Bandung',
        parentName: 'Salsa Safira',
        parentPhone: '+628130000002',
        parentEmail: null,
      },
      {
        username: 'alif.rachman',
        fullName: 'Alif Rachman',
        nisn: '0222200003',
        nik: '3201010102082003',
        gender: 'male',
        religion: 'Kristen',
        phone: '+628221200003',
        birthDate: '2008-03-09',
        birthPlace: 'Bogor',
        entryYear: 2025,
        address: 'Jl. Pajajaran No. 33, Bogor',
        parentName: 'Rachman',
        parentPhone: '+628130000003',
        parentEmail: 'rachman@example.com',
      },
      {
        username: 'tania.larasati',
        fullName: 'Tania Larasati',
        nisn: '0222200004',
        nik: '3201010102082004',
        gender: 'female',
        religion: 'Katolik',
        phone: '+628221200004',
        birthDate: '2008-09-20',
        birthPlace: 'Cimahi',
        entryYear: 2025,
        address: 'Jl. Melong No. 44, Cimahi',
        parentName: 'Larasati',
        parentPhone: '+628130000004',
        parentEmail: 'larasati@example.com',
      },
      {
        username: 'zaki.prakoso',
        fullName: 'Zaki Prakoso',
        nisn: '0222200005',
        nik: '3201010102082005',
        gender: 'male',
        religion: 'Islam',
        phone: '+628221200005',
        birthDate: '2008-12-01',
        birthPlace: 'Bekasi',
        entryYear: 2025,
        address: 'Jl. Ahmad Yani No. 55, Bekasi',
        parentName: 'Prakoso',
        parentPhone: '+628130000005',
        parentEmail: null,
      },
      {
        username: 'ayu.kusuma',
        fullName: 'Ayu Kusuma',
        nisn: '0222200006',
        nik: '3201010102082006',
        gender: 'female',
        religion: 'Islam',
        phone: '+628221200006',
        birthDate: '2008-05-28',
        birthPlace: 'Depok',
        entryYear: 2025,
        address: 'Jl. Margonda No. 66, Depok',
        parentName: 'Kusuma',
        parentPhone: '+628130000006',
        parentEmail: 'kusuma@example.com',
      },
      {
        username: 'kevin.wijaya',
        fullName: 'Kevin Wijaya',
        nisn: '0222200007',
        nik: '3201010102082007',
        gender: 'male',
        religion: 'Buddha',
        phone: '+628221200007',
        birthDate: '2008-01-21',
        birthPlace: 'Tangerang',
        entryYear: 2025,
        address: 'Jl. Serpong No. 77, Tangerang',
        parentName: 'Wijaya',
        parentPhone: '+628130000007',
        parentEmail: null,
      },
      {
        username: 'nisa.amelia',
        fullName: 'Nisa Amelia',
        nisn: '0222200008',
        nik: '3201010102082008',
        gender: 'female',
        religion: 'Islam',
        phone: '+628221200008',
        birthDate: '2008-08-14',
        birthPlace: 'Karawang',
        entryYear: 2025,
        address: 'Jl. Galuh Mas No. 88, Karawang',
        parentName: 'Amelia',
        parentPhone: '+628130000008',
        parentEmail: 'amelia@example.com',
      },
    ],
  },
];

type TenantClient = InstanceType<typeof TenantPrismaClient>;

function log(schema: string, message: string) {
  console.log(`[${schema}] ${message}`);
}

function shaRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function pickWeighted<T extends string>(
  seed: string,
  weights: Record<T, number>,
): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = shaRandom(seed) * total;
  let cursor = 0;
  for (const [key, weight] of entries) {
    cursor += weight;
    if (roll < cursor) return key;
  }
  return entries[entries.length - 1][0];
}

function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function getSchoolDays(count: number) {
  const days: Date[] = [];
  let cursor = startOfDay(new Date());
  while (days.length < count) {
    if (cursor.getDay() !== 0) days.push(new Date(cursor));
    cursor = addDays(cursor, -1);
  }
  return days.reverse();
}

function seedIdentityPrefix(schema: string) {
  return schema
    .replace(/^tenant_/, '')
    .replace(/[^a-z0-9]+/gi, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

function scopedStudentUsername(config: SchoolConfig, username: string) {
  return `${seedIdentityPrefix(config.schema)}.${username}`;
}

function scopedParentUsername(config: SchoolConfig, studentUsername: string) {
  return `parent.${scopedStudentUsername(config, studentUsername)}`;
}

function scopedSeedEmail(config: SchoolConfig, email: string) {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return `${seedIdentityPrefix(config.schema)}.${email}`;
  return `${email.slice(0, atIndex)}+${seedIdentityPrefix(config.schema)}${email.slice(
    atIndex,
  )}`;
}

async function ensureSchema(schema: string) {
  await PUBLIC_PRISMA.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
  );
}

function createTenantClient(schema: string): TenantClient {
  const url = tenantSeedUrl(schema);
  return new TenantPrismaClient({ datasources: { db: { url } } });
}

async function upsertUser(
  db: TenantClient,
  user: {
    email?: string;
    username?: string;
    fullName: string;
    role: 'teacher' | 'student' | 'parent';
  },
  passwordHash: string,
) {
  const where = user.email
    ? { email: user.email }
    : { username: user.username! };
  const existing = await db.user.findFirst({ where });
  if (existing) return existing;

  return db.user.create({
    data: {
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      passwordHash,
      role: user.role,
      status: 'active',
    },
  });
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
    if (existing.status !== 'active') {
      await db.enrollment.update({
        where: { id: existing.id },
        data: { status: 'active' },
      });
    }
    return;
  }

  await db.enrollment.create({
    data: {
      studentProfileId,
      classroomId,
      status: 'active',
    },
  });
}

async function deactivateLegacyUnscopedSchoolEnrollments(
  db: TenantClient,
  config: SchoolConfig,
  classroomIds: string[],
) {
  const legacyUsernames = config.students.map((student) => student.username);
  const result = await db.enrollment.updateMany({
    where: {
      status: 'active',
      classroomId: { in: classroomIds },
      studentProfile: {
        user: { username: { in: legacyUsernames } },
      },
    },
    data: { status: 'transferred' },
  });

  if (result.count > 0) {
    log(
      config.schema,
      `Deactivated ${result.count} legacy unscoped school enrollment(s)`,
    );
  }
}

async function upsertByName<
  T extends { id: string; name: string; deletedAt?: Date | null },
>(find: () => Promise<T | null>, create: () => Promise<T>) {
  const existing = await find();
  return existing ?? create();
}

async function seedSchool(config: SchoolConfig) {
  await ensureSchema(config.schema);
  const db = createTenantClient(config.schema);
  const passwordHash = await bcrypt.hash(config.password, 12);
  const schoolDays = getSchoolDays(30);

  try {
    log(config.schema, `Seeding ${config.label}`);
    log(config.schema, config.story);

    const subjectMap: Record<string, { id: string; name: string }> = {};
    for (const subject of SUBJECTS) {
      const row = await upsertByName(
        () =>
          db.subject.findFirst({
            where: { code: subject.code, deletedAt: null },
          }),
        () =>
          db.subject.create({
            data: {
              code: subject.code,
              name: subject.name,
              description: subject.description,
            },
          }),
      );
      subjectMap[subject.code] = row;
    }

    const roomMap: Record<string, { id: string; name: string }> = {};
    for (const room of ROOM_DATA) {
      const row = await upsertByName(
        () =>
          db.room.findFirst({ where: { name: room.name, deletedAt: null } }),
        () => db.room.create({ data: room as any }),
      );
      roomMap[room.name] = row;
    }

    const academicYear = await db.academicYear.upsert({
      where: { label_semester: { label: '2025/2026', semester: 1 } },
      update: {},
      create: {
        label: '2025/2026',
        semester: 1,
        startDate: new Date('2025-07-14'),
        endDate: new Date('2025-12-20'),
        isActive: true,
      },
    });

    const periodTemplate = await db.periodTemplate.upsert({
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
      update: {
        dayStart: '07:00',
      },
    });

    const periodRowMap: Record<number, { id: string; label: string }> = {};
    for (const row of PERIOD_ROWS) {
      const periodRow = await db.periodRow.upsert({
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
          activeDays: [],
        },
        update: {
          kind: row.kind as any,
          label: row.label,
          durationMin: row.durationMin,
          activeDays: [],
        },
      });
      periodRowMap[row.sortOrder] = periodRow;
    }

    const teacherMap: Record<
      string,
      { userId: string; profileId: string; fullName: string }
    > = {};
    for (const teacher of config.teachers) {
      const user = await upsertUser(
        db,
        { email: teacher.email, fullName: teacher.fullName, role: 'teacher' },
        passwordHash,
      );

      const profile =
        (await db.teacherProfile.findUnique({ where: { userId: user.id } })) ??
        (await db.teacherProfile.create({
          data: {
            userId: user.id,
            email: teacher.email,
            phone: teacher.phone,
            birthDate: toDate(teacher.birthDate),
            birthPlace: teacher.birthPlace,
            employmentStatus: teacher.employmentStatus as any,
            bio: `${teacher.fullName} is the ${subjectMap[teacher.subjectCode].name} lead at ${config.label}.`,
            status: 'active',
          },
        }));

      teacherMap[teacher.subjectCode] = {
        userId: user.id,
        profileId: profile.id,
        fullName: teacher.fullName,
      };
    }

    const classrooms = [
      {
        name: config.profile === 'strong' ? 'X-1 Science' : 'X-1 Social',
        gradeLevel: 10,
        academicYearId: academicYear.id,
        homeroomTeacherCode: 'MTK',
      },
      {
        name: config.profile === 'strong' ? 'X-2 Science' : 'X-2 Social',
        gradeLevel: 10,
        academicYearId: academicYear.id,
        homeroomTeacherCode: 'BIN',
      },
    ];

    const classroomRows: Array<{
      id: string;
      name: string;
      homeroomTeacherCode: string;
    }> = [];

    for (const classroom of classrooms) {
      const row =
        (await db.classroom.findFirst({
          where: {
            name: classroom.name,
            academicYearId: classroom.academicYearId,
            deletedAt: null,
          },
        })) ??
        (await db.classroom.create({
          data: {
            name: classroom.name,
            gradeLevel: classroom.gradeLevel,
            academicYearId: classroom.academicYearId,
          },
        }));

      classroomRows.push({
        id: row.id,
        name: row.name,
        homeroomTeacherCode: classroom.homeroomTeacherCode,
      });
    }

    await deactivateLegacyUnscopedSchoolEnrollments(
      db,
      config,
      classroomRows.map((classroom) => classroom.id),
    );

    for (const classroom of classroomRows) {
      const homeroomTeacher = teacherMap[classroom.homeroomTeacherCode];
      const existingAssignment = await db.homeroomAssignment.findFirst({
        where: {
          classroomId: classroom.id,
          academicYearId: academicYear.id,
          deletedAt: null,
          isActive: true,
        },
      });
      if (!existingAssignment) {
        await db.homeroomAssignment.create({
          data: {
            classroomId: classroom.id,
            teacherProfileId: homeroomTeacher.profileId,
            academicYearId: academicYear.id,
            notes: `${config.label} homeroom assignment`,
          },
        });
      }

      await db.classroom.update({
        where: { id: classroom.id },
        data: { homeroomUserId: homeroomTeacher.userId },
      });
    }

    // Subjects taught in each classroom.
    const classSubjectAssignments = [
      ['MTK', 1, 'Ruang 101'],
      ['BIN', 2, 'Ruang 101'],
      ['FIS', 3, 'Lab Sains'],
      ['KIM', 4, 'Lab Sains'],
      ['INF', 5, 'Ruang 102'],
      ['ING', 1, 'Ruang 102'],
    ] as const;

    for (const classroom of classroomRows) {
      for (const [
        subjectCode,
        sortOrder,
        roomName,
      ] of classSubjectAssignments) {
        const subject = subjectMap[subjectCode];
        const teacher = teacherMap[subjectCode] ?? teacherMap.MTK;
        const existing = await db.classSubject.findUnique({
          where: {
            classroomId_subjectId: {
              classroomId: classroom.id,
              subjectId: subject.id,
            },
          },
        });
        if (!existing) {
          await db.classSubject.create({
            data: {
              classroomId: classroom.id,
              subjectId: subject.id,
              teacherProfileId: teacher.profileId,
            },
          });
        }

        const requirement = await db.scheduleRequirement.findFirst({
          where: {
            classroomId: classroom.id,
            subjectId: subject.id,
            academicYearId: academicYear.id,
          },
        });
        if (!requirement) {
          await db.scheduleRequirement.create({
            data: {
              classroomId: classroom.id,
              subjectId: subject.id,
              teacherProfileId: teacher.profileId,
              roomId: roomMap[roomName].id,
              sessionsPerWeek:
                subjectCode === 'MTK' ? 4 : subjectCode === 'BIN' ? 3 : 2,
              academicYearId: academicYear.id,
            },
          });
        }
      }
    }

    const studentMap: Array<{
      id: string;
      userId: string;
      username: string;
      fullName: string;
      classroomId: string;
      classroomName: string;
      classroomIndex: number;
      academicYearId: string;
    }> = [];

    for (let i = 0; i < config.students.length; i += 1) {
      const student = config.students[i];
      const classroom = classroomRows[i < config.students.length / 2 ? 0 : 1];
      const username = scopedStudentUsername(config, student.username);
      const parentEmail = student.parentEmail
        ? scopedSeedEmail(config, student.parentEmail)
        : undefined;
      const user = await upsertUser(
        db,
        {
          username,
          fullName: student.fullName,
          role: 'student',
        },
        passwordHash,
      );

      const profile =
        (await db.studentProfile.findUnique({ where: { userId: user.id } })) ??
        (await db.studentProfile.create({
          data: {
            userId: user.id,
            nisn: student.nisn,
            nik: student.nik,
            gender: student.gender as any,
            religion: student.religion,
            phone: student.phone,
            birthDate: toDate(student.birthDate),
            birthPlace: student.birthPlace,
            entryYear: student.entryYear,
            address: student.address,
            status: 'active',
          },
        }));

      const parentUser = await upsertUser(
        db,
        {
          email: parentEmail,
          username: parentEmail
            ? undefined
            : scopedParentUsername(config, student.username),
          fullName: student.parentName,
          role: 'parent',
        },
        passwordHash,
      );

      const guardianExists = await db.guardian.findFirst({
        where: { studentProfileId: profile.id, name: student.parentName },
      });
      if (!guardianExists) {
        await db.guardian.create({
          data: {
            studentProfileId: profile.id,
            userId: parentUser.id,
            name: student.parentName,
            relationship: 'parent',
            phone: student.parentPhone,
            email: parentEmail,
            isPrimary: true,
          },
        });
      } else if (!guardianExists.userId) {
        await db.guardian.update({
          where: { id: guardianExists.id },
          data: { userId: parentUser.id },
        });
      }

      await ensureSingleActiveEnrollment(
        db,
        profile.id,
        classroom.id,
        academicYear.id,
      );

      studentMap.push({
        id: profile.id,
        userId: user.id,
        username,
        fullName: student.fullName,
        classroomId: classroom.id,
        classroomName: classroom.name,
        classroomIndex: i < config.students.length / 2 ? 0 : 1,
        academicYearId: academicYear.id,
      });
    }

    // Portfolio + achievement storylines.
    const portfolioTitlesStrong = [
      'Robotics Club Prototype',
      'Mathematics Diagnostic Project',
      'Indonesian Debate Portfolio',
      'Physics Experiment Journal',
      'Chemistry Poster Series',
      'Digital Storytelling Blog',
      'Science Fair Reflection',
      'Leadership and Service Log',
    ];
    const portfolioTitlesWeak = [
      'Class Project Notebook',
      'Reading Log and Reflection',
      'Simple Poster Design',
      'Community Observation Report',
      'ICT Basics Portfolio',
      'Speech Practice Notes',
      'Group Presentation Summary',
      'Personal Learning Journal',
    ];

    const achievementTitlesStrong = [
      {
        title: 'Juara 1 Lomba Matematika Tingkat Kota',
        category: 'competition',
        level: 'city',
      },
      {
        title: 'Finalis Debat Bahasa Indonesia Tingkat Provinsi',
        category: 'academic',
        level: 'provincial',
      },
      {
        title: 'Juara 2 Basket Antar Sekolah',
        category: 'sports',
        level: 'city',
      },
      {
        title: 'Juara 1 Karya Tulis Ilmiah Remaja',
        category: 'academic',
        level: 'national',
      },
      { title: 'Poster Sains Terbaik', category: 'arts', level: 'school' },
      {
        title: 'Juara 3 Olimpiade Kimia',
        category: 'competition',
        level: 'city',
      },
      {
        title: 'Juara 1 Fisika Eksperimen',
        category: 'competition',
        level: 'provincial',
      },
      {
        title: 'Relawan PMR Berprestasi',
        category: 'organization',
        level: 'district',
      },
    ] as const;

    const achievementTitlesWeak = [
      {
        title: 'Peserta Lomba Poster Sekolah',
        category: 'arts',
        level: 'school',
      },
      {
        title: 'Sertifikat Literasi Digital Dasar',
        category: 'academic',
        level: 'school',
      },
      {
        title: 'Juara Harapan Cerdas Cermat',
        category: 'competition',
        level: 'district',
      },
      {
        title: 'Penghargaan Kehadiran Terbaik Bulanan',
        category: 'organization',
        level: 'school',
      },
      {
        title: 'Finalis Pentas Seni Sekolah',
        category: 'arts',
        level: 'school',
      },
      {
        title: 'Partisipan Olimpiade Sains',
        category: 'competition',
        level: 'district',
      },
      {
        title: 'Proyek Kelompok Informatika',
        category: 'academic',
        level: 'school',
      },
      {
        title: 'Relawan Kegiatan Sosial',
        category: 'organization',
        level: 'district',
      },
    ] as const;

    for (let i = 0; i < studentMap.length; i += 1) {
      const student = studentMap[i];
      const isStrong = config.profile === 'strong';
      const portfolioTitle = isStrong
        ? portfolioTitlesStrong[i]
        : portfolioTitlesWeak[i];
      const portfolioType =
        i % 4 === 0
          ? 'project'
          : i % 4 === 1
            ? 'extracurricular'
            : i % 4 === 2
              ? 'certificate'
              : 'personal_development';

      const portfolio =
        (await db.studentPortfolio.findFirst({
          where: { studentProfileId: student.id, title: portfolioTitle },
        })) ??
        (await db.studentPortfolio.create({
          data: {
            studentProfileId: student.id,
            title: portfolioTitle,
            type: portfolioType as any,
            description: isStrong
              ? `${student.fullName} completed a ${portfolioType} assignment with strong reflection and presentation skills.`
              : `${student.fullName} completed a basic ${portfolioType} assignment and shared a short reflection.`,
            subjectId: subjectMap[SUBJECTS[i % SUBJECTS.length].code].id,
            startDate: toDate('2025-08-01'),
            endDate: toDate('2025-10-15'),
          },
        }));

      const portfolioAttachmentExists = await db.portfolioAttachment.findFirst({
        where: {
          portfolioId: portfolio.id,
          fileName: `${student.username}-portfolio.pdf`,
        },
      });
      if (!portfolioAttachmentExists) {
        await db.portfolioAttachment.create({
          data: {
            portfolioId: portfolio.id,
            fileUrl: `https://dummy.deltra.local/${config.schema}/portfolios/${student.username}.pdf`,
            fileName: `${student.username}-portfolio.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 180000 + i * 1500,
          },
        });
      }

      const achievementMeta = isStrong
        ? achievementTitlesStrong[i]
        : achievementTitlesWeak[i];
      const achievementTitle = achievementMeta.title;
      const achievement =
        (await db.studentAchievement.findFirst({
          where: { studentProfileId: student.id, title: achievementTitle },
        })) ??
        (await db.studentAchievement.create({
          data: {
            studentProfileId: student.id,
            title: achievementTitle,
            category: achievementMeta.category as any,
            level: achievementMeta.level as any,
            description: isStrong
              ? `${student.fullName} represented ${config.label} in a high-performing activity and finished strongly.`
              : `${student.fullName} participated in a school-level activity and showed good effort.`,
            organizer: isStrong
              ? 'Foundation Academic Board'
              : 'School Student Affairs',
            eventName: isStrong
              ? 'Network Academic Week 2025'
              : 'Campus Activity Month 2025',
            achievedAt: toDate(`2025-11-${String(5 + i).padStart(2, '0')}`),
            rank: isStrong
              ? i % 2 === 0
                ? 'Juara 1'
                : 'Finalis'
              : i % 2 === 0
                ? 'Peserta'
                : 'Terbaik',
          },
        }));

      const achievementAttachmentExists =
        await db.achievementAttachment.findFirst({
          where: {
            achievementId: achievement.id,
            fileName: `${student.username}-achievement.pdf`,
          },
        });
      if (!achievementAttachmentExists) {
        await db.achievementAttachment.create({
          data: {
            achievementId: achievement.id,
            fileUrl: `https://dummy.deltra.local/${config.schema}/achievements/${student.username}.pdf`,
            fileName: `${student.username}-achievement.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 120000 + i * 1200,
          },
        });
      }
    }

    const scheduleEntriesByClassroomDay = new Map<
      string,
      Array<{ id: string; teacherUserId: string }>
    >();

    // Timetable + schedules.
    for (
      let classroomIndex = 0;
      classroomIndex < classroomRows.length;
      classroomIndex += 1
    ) {
      const classroom = classroomRows[classroomIndex];
      const status = config.scheduleStatuses[classroomIndex];

      const schedule =
        (await db.schedule.findUnique({
          where: {
            classroomId_academicYearId: {
              classroomId: classroom.id,
              academicYearId: academicYear.id,
            },
          },
        })) ??
        (await db.schedule.create({
          data: {
            classroomId: classroom.id,
            academicYearId: academicYear.id,
            status,
            publishedAt: status === 'published' ? new Date() : null,
          },
        }));

      if (schedule.status !== status) {
        await db.schedule.update({
          where: { id: schedule.id },
          data: {
            status,
            publishedAt: status === 'published' ? new Date() : null,
            archivedAt: null,
            deletedAt: null,
          },
        });
      }

      const entries = [
        {
          subjectCode: 'MTK',
          teacherCode: 'MTK',
          room: 'Ruang 101',
          dayOfWeek: 1,
          periodSortOrder: 1,
          notes: 'Mathematics block',
        },
        {
          subjectCode: 'BIN',
          teacherCode: 'BIN',
          room: 'Ruang 101',
          dayOfWeek: 1,
          periodSortOrder: 2,
          notes: 'Language block',
        },
        {
          subjectCode: 'FIS',
          teacherCode: 'FIS',
          room: 'Lab Sains',
          dayOfWeek: 2,
          periodSortOrder: 1,
          notes: 'Physics practicum',
        },
        {
          subjectCode: 'KIM',
          teacherCode: 'KIM',
          room: 'Lab Sains',
          dayOfWeek: 3,
          periodSortOrder: 4,
          notes: 'Chemistry lab',
        },
        {
          subjectCode: 'INF',
          teacherCode: 'INF',
          room: 'Ruang 102',
          dayOfWeek: 4,
          periodSortOrder: 5,
          notes: 'Computer lab',
        },
        {
          subjectCode: 'ING',
          teacherCode: 'BIN',
          room: 'Ruang 102',
          dayOfWeek: 5,
          periodSortOrder: 1,
          notes: 'English practice',
        },
      ] as const;

      for (const entry of entries) {
        const subject = subjectMap[entry.subjectCode];
        const teacher = teacherMap[entry.teacherCode];
        const periodRow = periodRowMap[entry.periodSortOrder];
        const existingEntry = await db.scheduleEntry.findFirst({
          where: {
            scheduleId: schedule.id,
            subjectId: subject.id,
            teacherProfileId: teacher.profileId,
            dayOfWeek: entry.dayOfWeek,
            periodRowId: periodRow.id,
            deletedAt: null,
          },
        });
        const scheduleEntry =
          existingEntry ??
          (await db.scheduleEntry.create({
            data: {
              scheduleId: schedule.id,
              subjectId: subject.id,
              teacherProfileId: teacher.profileId,
              roomId: roomMap[entry.room].id,
              dayOfWeek: entry.dayOfWeek,
              periodRowId: periodRow.id,
              notes: entry.notes,
            },
          }));

        const entryKey = `${classroom.id}:${entry.dayOfWeek}`;
        const dayEntries = scheduleEntriesByClassroomDay.get(entryKey) ?? [];
        dayEntries.push({
          id: scheduleEntry.id,
          teacherUserId: teacher.userId,
        });
        scheduleEntriesByClassroomDay.set(entryKey, dayEntries);
      }
    }

    // A small unavailability gap in the growth-profile school to make the schedule story more realistic.
    if (config.profile === 'growth') {
      const teacher = teacherMap.FIS;
      const periodRow = periodRowMap[2];
      const existing = await db.teacherUnavailability.findUnique({
        where: {
          teacherProfileId_dayOfWeek_periodRowId: {
            teacherProfileId: teacher.profileId,
            dayOfWeek: 3,
            periodRowId: periodRow.id,
          },
        },
      });
      if (!existing) {
        await db.teacherUnavailability.create({
          data: {
            teacherProfileId: teacher.profileId,
            dayOfWeek: 3,
            periodRowId: periodRow.id,
            reason: 'Training workshop',
          },
        });
      }
    }

    // 30-day attendance history.
    for (let i = 0; i < studentMap.length; i += 1) {
      const student = studentMap[i];
      for (let dayIndex = 0; dayIndex < schoolDays.length; dayIndex += 1) {
        const date = schoolDays[dayIndex];
        const attendanceDayOfWeek = date.getDay();
        const dayEntries =
          scheduleEntriesByClassroomDay.get(
            `${student.classroomId}:${attendanceDayOfWeek}`,
          ) ?? scheduleEntriesByClassroomDay.get(`${student.classroomId}:1`);
        if (!dayEntries?.length) {
          throw new Error(
            `No schedule entry found for attendance seed in ${config.schema}`,
          );
        }

        const scheduleEntry = dayEntries[dayIndex % dayEntries.length];
        const status = pickWeighted(
          `${config.schema}:${student.username}:${dayIndex}`,
          config.attendanceWeights,
        );
        const existing = await db.attendanceRecord.findFirst({
          where: {
            studentProfileId: student.id,
            attendanceDate: date,
            scheduleEntryId: scheduleEntry.id,
          },
        });
        if (!existing) {
          await db.attendanceRecord.create({
            data: {
              studentProfileId: student.id,
              classroomId: student.classroomId,
              academicYearId: student.academicYearId,
              scheduleEntryId: scheduleEntry.id,
              attendanceDate: date,
              status: status as any,
              lateMinutes: status === 'late' ? 15 : null,
              notes:
                status === 'absent'
                  ? 'Absent without notice'
                  : status === 'sick'
                    ? 'Reported sick by parent'
                    : status === 'excused'
                      ? 'Excused by guardian'
                      : status === 'late'
                        ? 'Late arrival due to traffic'
                        : null,
              markedByUserId: scheduleEntry.teacherUserId,
            },
          });
        }
      }
    }

    log(config.schema, `Completed ${config.label}`);
    log(
      config.schema,
      `Teachers: ${config.teachers.length}, Students: ${config.students.length}, Classrooms: ${classroomRows.length}`,
    );
  } finally {
    await db.$disconnect();
  }
}

function resolveSeedConfigs() {
  const targetSchema = process.env.SEED_SCHEMA?.trim();
  if (!targetSchema) return SCHOOL_CONFIGS;

  const normalizedTarget = targetSchema.startsWith('tenant_')
    ? targetSchema
    : `tenant_${targetSchema}`;
  const matchingConfig = SCHOOL_CONFIGS.find(
    (config) =>
      config.schema === targetSchema || config.schema === normalizedTarget,
  );

  if (!matchingConfig) {
    console.warn(
      `[seed] SEED_SCHEMA=${targetSchema} does not match tenant_school_1 or tenant_school_2; using the tenant_school_1 data profile.`,
    );
  }

  return [{ ...(matchingConfig ?? SCHOOL_CONFIGS[0]), schema: targetSchema }];
}

async function main() {
  const configs = resolveSeedConfigs();
  for (const school of configs) {
    await seedSchool(school);
  }

  console.log(
    `\nSeed complete for ${configs.map((config) => config.schema).join(', ')}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await PUBLIC_PRISMA.$disconnect();
  });
