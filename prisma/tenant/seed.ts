/**
 * Tenant Seed — sample teachers, students, portfolios, and achievements.
 *
 * Usage:
 *   SEED_SCHEMA=tenant_sma_test npx ts-node --project tsconfig.seed.json prisma/tenant/seed.ts
 *
 * The script is idempotent: re-running skips already-existing records.
 */

import { PrismaClient } from '../../src/generated/tenant-client';
import * as bcrypt from 'bcrypt';
import { tenantSeedUrl } from './seed-url';

// ── Connection ──────────────────────────────────────────────────────────────

const schema  = process.env.SEED_SCHEMA ?? 'tenant_sma_test';
const dbUrl = tenantSeedUrl(schema);

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`[seed] ${msg}`); }

async function upsertUser(
  data: { email?: string; username?: string; fullName: string; role: 'teacher' | 'student' | 'school_admin' | 'parent' },
  passwordHash: string,
) {
  const where = data.email ? { email: data.email } : { username: data.username! };
  const existing = await prisma.user.findFirst({ where });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: data.role,
        status: 'active',
        deletedAt: null,
      },
    });
  }

  return prisma.user.create({
    data: {
      email:        data.email,
      username:     data.username,
      fullName:     data.fullName,
      passwordHash,
      role:         data.role,
      status:       'active',
    },
  });
}

function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const PASSWORD_HASH = await bcrypt.hash('password123', 12);

  // ── 1. Classroom ─────────────────────────────────────────────────────────────

  log('Upserting classroom...');

  const classroom = await prisma.classroom.upsert({
    where: { name_academicYear_semester: { name: 'X IPA 1', academicYear: '2025/2026', semester: 1 } },
    create: { name: 'X IPA 1', gradeLevel: 10, academicYear: '2025/2026', semester: 1 },
    update: {},
  });

  const classroom2 = await prisma.classroom.upsert({
    where: { name_academicYear_semester: { name: 'X IPA 2', academicYear: '2025/2026', semester: 1 } },
    create: { name: 'X IPA 2', gradeLevel: 10, academicYear: '2025/2026', semester: 1 },
    update: {},
  });

  log(`  classroom: ${classroom.name}`);
  log(`  classroom: ${classroom2.name}`);

  // ── 2. Subjects ──────────────────────────────────────────────────────────────

  log('Upserting subjects...');

  const subjectData = [
    { code: 'MTK',  name: 'Matematika' },
    { code: 'FIS',  name: 'Fisika' },
    { code: 'KIM',  name: 'Kimia' },
    { code: 'BIN',  name: 'Bahasa Indonesia' },
    { code: 'SEJ',  name: 'Sejarah Indonesia' },
  ];

  const subjects: Record<string, { id: string; name: string }> = {};
  for (const s of subjectData) {
    const existing = await prisma.subject.findFirst({ where: { code: s.code } });
    const subject  = existing ?? await prisma.subject.create({ data: s });
    subjects[s.code] = subject;
    log(`  subject: ${subject.name}`);
  }

  // ── 2b. Rooms ───────────────────────────────────────────────────────────────

  log('Upserting rooms...');

  const roomData = [
    { name: 'Ruang A101', capacity: 36, description: 'Ruang kelas utama X IPA 1' },
    { name: 'Ruang A102', capacity: 36, description: 'Ruang kelas utama X IPA 2' },
    { name: 'Lab Fisika', capacity: 24, description: 'Laboratorium fisika' },
  ];

  const rooms: Record<string, { id: string; name: string }> = {};
  for (const r of roomData) {
    const existing = await prisma.room.findFirst({ where: { name: r.name, deletedAt: null } });
    const room = existing ?? await prisma.room.create({ data: r });
    rooms[r.name] = room;
    log(`  room: ${room.name}`);
  }

  // ── 3. Teachers ──────────────────────────────────────────────────────────────

  log('Upserting teachers...');

  const teacherSeed = [
    {
      email: 'budi.santoso@sekolah.id', fullName: 'Budi Santoso',
      nuptk: '1234567890123401', nik: '3201010101850001',
      gender: 'male',   religion: 'Islam',   phone: '+6281111000001',
      birthDate: new Date('1985-03-10'), birthPlace: 'Bandung',
      employmentStatus: 'pns',   subjectCode: 'MTK',
    },
    {
      email: 'siti.rahayu@sekolah.id', fullName: 'Siti Rahayu',
      nuptk: '1234567890123402', nik: '3201010101880002',
      gender: 'female', religion: 'Islam',   phone: '+6281111000002',
      birthDate: new Date('1988-07-22'), birthPlace: 'Jakarta',
      employmentStatus: 'tetap',  subjectCode: 'BIN',
    },
    {
      email: 'ahmad.fauzi@sekolah.id', fullName: 'Ahmad Fauzi',
      nuptk: '1234567890123403', nik: '3201010101900003',
      gender: 'male',   religion: 'Islam',   phone: '+6281111000003',
      birthDate: new Date('1990-01-15'), birthPlace: 'Surabaya',
      employmentStatus: 'honorer', subjectCode: 'FIS',
    },
    {
      email: 'dewi.lestari@sekolah.id', fullName: 'Dewi Lestari',
      nuptk: '1234567890123404', nik: '3201010101870004',
      gender: 'female', religion: 'Kristen', phone: '+6281111000004',
      birthDate: new Date('1987-11-05'), birthPlace: 'Medan',
      employmentStatus: 'p3k',    subjectCode: 'KIM',
    },
    {
      email: 'rudi.hermawan@sekolah.id', fullName: 'Rudi Hermawan',
      nuptk: '1234567890123405', nik: '3201010101820005',
      gender: 'male',   religion: 'Islam',   phone: '+6281111000005',
      birthDate: new Date('1982-06-30'), birthPlace: 'Yogyakarta',
      employmentStatus: 'pns',   subjectCode: 'SEJ',
    },
  ];

  const teacherProfiles: Array<{ id: string; userId: string }> = [];

  for (const t of teacherSeed) {
    const user = await upsertUser({ email: t.email, fullName: t.fullName, role: 'teacher' }, PASSWORD_HASH);

    let profile = await prisma.teacherProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await prisma.teacherProfile.create({
        data: {
          userId:           user.id,
          nuptk:            t.nuptk,
          nik:              t.nik,
          gender:           t.gender as any,
          religion:         t.religion,
          phone:            t.phone,
          email:            t.email,
          birthDate:        t.birthDate,
          birthPlace:       t.birthPlace,
          employmentStatus: t.employmentStatus as any,
          bio:              `Guru ${subjects[t.subjectCode].name} berpengalaman di ${t.birthPlace}.`,
          status:           'active',
        },
      });
    }

    // Link teacher → subject → classroom
    const subjectId = subjects[t.subjectCode].id;
    const cs = await prisma.classSubject.findUnique({
      where: { classroomId_subjectId: { classroomId: classroom.id, subjectId } },
    });
    if (!cs) {
      await prisma.classSubject.create({
        data: { classroomId: classroom.id, subjectId, teacherProfileId: profile.id },
      });
    }

    teacherProfiles.push(profile);
    log(`  teacher: ${t.fullName} (${t.subjectCode})`);
  }

  // ── 3b. Homeroom assignment ────────────────────────────────────────────────

  log('Upserting homeroom assignment...');

  const activeHomeroom = await prisma.homeroomAssignment.findFirst({
    where: { classroomId: classroom.id, isActive: true, deletedAt: null },
  });
  if (!activeHomeroom) {
    await prisma.homeroomAssignment.create({
      data: {
        classroomId: classroom.id,
        teacherProfileId: teacherProfiles[0].id,
        academicYear: '2025/2026',
        semester: 1,
        notes: 'Wali kelas dummy seed',
      },
    });
    await prisma.classroom.update({
      where: { id: classroom.id },
      data: { homeroomUserId: teacherProfiles[0].userId },
    });
  }

  // ── 4. Students ──────────────────────────────────────────────────────────────

  log('Upserting students...');

  const studentSeed = [
    {
      username: 'andi.pratama',   fullName: 'Andi Pratama',
      nisn: '0123456001', nik: '3201010101080001',
      gender: 'male',   religion: 'Islam',    phone: '+6282111000001',
      birthDate: new Date('2008-04-12'), birthPlace: 'Bandung',
      entryYear: 2024, address: 'Jl. Merdeka No. 1, Bandung',
      parentName: 'Hendra Pratama', parentPhone: '+6281200000001', parentEmail: 'hendra@email.com',
    },
    {
      username: 'sari.dewi',      fullName: 'Sari Dewi',
      nisn: '0123456002', nik: '3201010101080002',
      gender: 'female', religion: 'Islam',    phone: '+6282111000002',
      birthDate: new Date('2008-08-25'), birthPlace: 'Jakarta',
      entryYear: 2024, address: 'Jl. Sudirman No. 45, Jakarta',
      parentName: 'Budi Dewi', parentPhone: '+6281200000002', parentEmail: 'budidewi@email.com',
    },
    {
      username: 'budi.kurniawan', fullName: 'Budi Kurniawan',
      nisn: '0123456003', nik: '3201010101080003',
      gender: 'male',   religion: 'Kristen', phone: '+6282111000003',
      birthDate: new Date('2008-02-14'), birthPlace: 'Medan',
      entryYear: 2024, address: 'Jl. Pahlawan No. 12, Medan',
      parentName: 'Susanto Kurniawan', parentPhone: '+6281200000003', parentEmail: null,
    },
    {
      username: 'rina.susanti',   fullName: 'Rina Susanti',
      nisn: '0123456004', nik: '3201010101080004',
      gender: 'female', religion: 'Katolik', phone: '+6282111000004',
      birthDate: new Date('2008-11-03'), birthPlace: 'Surabaya',
      entryYear: 2024, address: 'Jl. Ahmad Yani No. 67, Surabaya',
      parentName: 'Agus Susanti', parentPhone: '+6281200000004', parentEmail: 'agus.susanti@email.com',
    },
    {
      username: 'doni.saputra',   fullName: 'Doni Saputra',
      nisn: '0123456005', nik: '3201010101080005',
      gender: 'male',   religion: 'Islam',    phone: '+6282111000005',
      birthDate: new Date('2008-06-19'), birthPlace: 'Yogyakarta',
      entryYear: 2024, address: 'Jl. Malioboro No. 100, Yogyakarta',
      parentName: 'Widi Saputra', parentPhone: '+6281200000005', parentEmail: null,
    },
    {
      username: 'maya.indah',     fullName: 'Maya Indah Lestari',
      nisn: '0123456006', nik: '3201010101080006',
      gender: 'female', religion: 'Islam',    phone: '+6282111000006',
      birthDate: new Date('2008-09-30'), birthPlace: 'Semarang',
      entryYear: 2024, address: 'Jl. Pemuda No. 23, Semarang',
      parentName: 'Tono Lestari', parentPhone: '+6281200000006', parentEmail: 'tono.les@email.com',
    },
    {
      username: 'fajar.nugraha',  fullName: 'Fajar Nugraha',
      nisn: '0123456007', nik: '3201010101080007',
      gender: 'male',   religion: 'Islam',    phone: '+6282111000007',
      birthDate: new Date('2008-01-07'), birthPlace: 'Bogor',
      entryYear: 2024, address: 'Jl. Raya Bogor No. 5, Bogor',
      parentName: 'Irwan Nugraha', parentPhone: '+6281200000007', parentEmail: null,
    },
    {
      username: 'lina.marlena',   fullName: 'Lina Marlena',
      nisn: '0123456008', nik: '3201010101080008',
      gender: 'female', religion: 'Kristen', phone: '+6282111000008',
      birthDate: new Date('2008-05-22'), birthPlace: 'Makassar',
      entryYear: 2024, address: 'Jl. Veteran No. 89, Makassar',
      parentName: 'Hendri Marlena', parentPhone: '+6281200000008', parentEmail: 'hendrimarlena@email.com',
    },
    {
      username: 'hendra.wijaya',  fullName: 'Hendra Wijaya',
      nisn: '0123456009', nik: '3201010101080009',
      gender: 'male',   religion: 'Hindu',   phone: '+6282111000009',
      birthDate: new Date('2008-07-11'), birthPlace: 'Denpasar',
      entryYear: 2024, address: 'Jl. Ngurah Rai No. 15, Denpasar',
      parentName: 'Putu Wijaya', parentPhone: '+6281200000009', parentEmail: null,
    },
    {
      username: 'yuni.astuti',    fullName: 'Yuni Astuti',
      nisn: '0123456010', nik: '3201010101080010',
      gender: 'female', religion: 'Islam',    phone: '+6282111000010',
      birthDate: new Date('2008-03-16'), birthPlace: 'Malang',
      entryYear: 2024, address: 'Jl. Ijen No. 34, Malang',
      parentName: 'Arif Astuti', parentPhone: '+6281200000010', parentEmail: 'arif.astuti@email.com',
    },
  ];

  const studentProfiles: Array<{ id: string; userId: string; fullName: string }> = [];

  for (const s of studentSeed) {
    const user = await upsertUser({ username: s.username, fullName: s.fullName, role: 'student' }, PASSWORD_HASH);

    let profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await prisma.studentProfile.create({
        data: {
          userId:     user.id,
          nisn:       s.nisn,
          nik:        s.nik,
          gender:     s.gender as any,
          religion:   s.religion,
          phone:      s.phone,
          birthDate:  s.birthDate,
          birthPlace: s.birthPlace,
          entryYear:  s.entryYear,
          address:    s.address,
          status:     'active',
        },
      });
    }

    const parentUser = await upsertUser(
      {
        email: s.parentEmail ?? undefined,
        username: s.parentEmail ? undefined : `parent.${s.username}`,
        fullName: s.parentName,
        role: 'parent',
      },
      PASSWORD_HASH,
    );

    // Guardian
    const guardianCount = await prisma.guardian.count({ where: { studentProfileId: profile.id } });
    if (guardianCount === 0) {
      await prisma.guardian.create({
        data: {
          studentProfileId: profile.id,
          userId:           parentUser.id,
          name:             s.parentName,
          relationship:     'parent',
          phone:            s.parentPhone,
          email:            s.parentEmail ?? undefined,
          isPrimary:        true,
        },
      });
    } else {
      await prisma.guardian.updateMany({
        where: { studentProfileId: profile.id, userId: null },
        data: { userId: parentUser.id },
      });
    }

    // Enrollment
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentProfileId_classroomId: { studentProfileId: profile.id, classroomId: classroom.id } },
    });
    if (!enrolled) {
      await prisma.enrollment.create({
        data: { studentProfileId: profile.id, classroomId: classroom.id, status: 'active' },
      });
    }

    studentProfiles.push({ id: profile.id, userId: user.id, fullName: s.fullName });
    log(`  student: ${s.fullName}`);
  }

  // ── 5. Portfolios ─────────────────────────────────────────────────────────────

  log('Upserting portfolios...');

  const portfolioSeed = [
    // Andi Pratama
    { idx: 0, title: 'Aplikasi Manajemen Perpustakaan Sekolah', type: 'project', subjectCode: 'MTK',
      description: 'Membangun aplikasi desktop untuk mengelola koleksi buku, peminjaman, dan pengembalian di perpustakaan sekolah menggunakan Python dan SQLite.',
      startDate: new Date('2024-08-01'), endDate: new Date('2024-11-30') },
    { idx: 0, title: 'Anggota Klub Robotika', type: 'extracurricular', subjectCode: null,
      description: 'Aktif sebagai anggota klub robotika sekolah, mengikuti latihan rutin setiap minggu dan berpartisipasi dalam kompetisi tingkat kota.',
      startDate: new Date('2024-07-15'), endDate: null },

    // Sari Dewi
    { idx: 1, title: 'Karya Tulis Ilmiah: Dampak Media Sosial terhadap Pelajar', type: 'project', subjectCode: 'BIN',
      description: 'Penelitian ilmiah tentang pengaruh penggunaan media sosial terhadap prestasi akademik dan kesehatan mental pelajar SMA.',
      startDate: new Date('2024-09-01'), endDate: new Date('2024-12-01') },
    { idx: 1, title: 'Sertifikat TOEFL ITP Score 550', type: 'certificate', subjectCode: null,
      description: 'Lulus ujian TOEFL ITP dengan skor 550, membuktikan kemampuan bahasa Inggris tingkat intermediate-advanced.',
      startDate: new Date('2024-10-15'), endDate: null },

    // Budi Kurniawan
    { idx: 2, title: 'Proyek Fisika: Turbin Angin Mini', type: 'project', subjectCode: 'FIS',
      description: 'Merancang dan membangun prototipe turbin angin mini dari bahan daur ulang sebagai sumber energi terbarukan skala kecil.',
      startDate: new Date('2024-08-20'), endDate: new Date('2024-10-20') },
    { idx: 2, title: 'Kapten Tim Basket Sekolah', type: 'extracurricular', subjectCode: null,
      description: 'Memimpin tim basket putra sekolah dalam latihan dan kompetisi antar sekolah se-kota.',
      startDate: new Date('2024-07-01'), endDate: null },

    // Rina Susanti
    { idx: 3, title: 'Riset Kimia: Pewarna Alami dari Tanaman Lokal', type: 'project', subjectCode: 'KIM',
      description: 'Mengeksplorasi potensi tanaman lokal sebagai sumber pewarna alami yang ramah lingkungan untuk industri tekstil.',
      startDate: new Date('2024-09-10'), endDate: new Date('2024-12-10') },
    { idx: 3, title: 'Ketua OSIS Periode 2024/2025', type: 'extracurricular', subjectCode: null,
      description: 'Memimpin Organisasi Siswa Intra Sekolah dengan program kerja yang berfokus pada pengembangan karakter dan kreativitas siswa.',
      startDate: new Date('2024-07-01'), endDate: new Date('2025-06-30') },

    // Doni Saputra
    { idx: 4, title: 'Proyek Sejarah: Digitalisasi Arsip Lokal', type: 'project', subjectCode: 'SEJ',
      description: 'Memdigitalisasi dan mendokumentasikan arsip sejarah lokal desa sekitar sekolah sebagai upaya pelestarian budaya.',
      startDate: new Date('2024-10-01'), endDate: new Date('2024-12-15') },
    { idx: 4, title: 'Pengembangan Diri: Kursus Desain Grafis', type: 'personal_development', subjectCode: null,
      description: 'Menyelesaikan kursus desain grafis online selama 3 bulan, mencakup Adobe Photoshop, Illustrator, dan prinsip desain visual.',
      startDate: new Date('2024-08-01'), endDate: new Date('2024-10-31') },

    // Maya Indah
    { idx: 5, title: 'Blog Sains: "Kimia di Sekitar Kita"', type: 'project', subjectCode: 'KIM',
      description: 'Mengelola blog edukatif yang menjelaskan fenomena kimia sehari-hari dengan bahasa yang mudah dipahami pelajar.',
      startDate: new Date('2024-09-01'), endDate: null },
    { idx: 5, title: 'Anggota Paduan Suara Sekolah', type: 'extracurricular', subjectCode: null,
      description: 'Aktif dalam paduan suara sekolah, tampil dalam berbagai acara sekolah dan festival musik tingkat kota.',
      startDate: new Date('2024-07-15'), endDate: null },

    // Fajar Nugraha
    { idx: 6, title: 'Program Magang di Lab Fisika Universitas', type: 'project', subjectCode: 'FIS',
      description: 'Mengikuti program magang selama 2 minggu di laboratorium fisika universitas setempat, mempelajari teknik eksperimen tingkat lanjut.',
      startDate: new Date('2024-11-01'), endDate: new Date('2024-11-14') },
    { idx: 6, title: 'Sertifikat Koding Python Dasar', type: 'certificate', subjectCode: null,
      description: 'Menyelesaikan kursus Python dasar dari platform online, mencakup variabel, fungsi, OOP, dan dasar-dasar data science.',
      startDate: new Date('2024-09-15'), endDate: new Date('2024-10-15') },

    // Lina Marlena
    { idx: 7, title: 'Antologi Puisi: "Catatan Pelajar"', type: 'project', subjectCode: 'BIN',
      description: 'Menyusun kumpulan puisi yang menggambarkan pengalaman dan refleksi sebagai pelajar di era digital.',
      startDate: new Date('2024-08-01'), endDate: new Date('2024-11-01') },
    { idx: 7, title: 'Pelatihan Kepemimpinan Nasional', type: 'personal_development', subjectCode: null,
      description: 'Mengikuti pelatihan kepemimpinan nasional selama 5 hari yang diselenggarakan oleh organisasi pemuda nasional.',
      startDate: new Date('2024-10-20'), endDate: new Date('2024-10-25') },

    // Hendra Wijaya
    { idx: 8, title: 'Model Matematika untuk Prediksi Cuaca Lokal', type: 'project', subjectCode: 'MTK',
      description: 'Mengembangkan model statistik sederhana untuk memprediksi pola cuaca lokal berdasarkan data historis BMKG.',
      startDate: new Date('2024-09-20'), endDate: new Date('2024-12-20') },
    { idx: 8, title: 'Juara Pramuka Tingkat Kwarcab', type: 'extracurricular', subjectCode: null,
      description: 'Mewakili sekolah dalam perlombaan pramuka tingkat kwarcab dan meraih juara umum.',
      startDate: new Date('2024-08-17'), endDate: new Date('2024-08-19') },

    // Yuni Astuti
    { idx: 9, title: 'Poster Ilmiah: Efisiensi Energi di Sekolah', type: 'project', subjectCode: 'KIM',
      description: 'Membuat poster ilmiah tentang langkah-langkah praktis penghematan energi di lingkungan sekolah.',
      startDate: new Date('2024-10-01'), endDate: new Date('2024-11-15') },
    { idx: 9, title: 'Koordinator Tim PMR', type: 'extracurricular', subjectCode: null,
      description: 'Memimpin tim Palang Merah Remaja sekolah dalam kegiatan donor darah, pertolongan pertama, dan penyuluhan kesehatan.',
      startDate: new Date('2024-07-01'), endDate: null },
  ];

  for (const p of portfolioSeed) {
    const sp    = studentProfiles[p.idx];
    const count = await prisma.studentPortfolio.count({
      where: { studentProfileId: sp.id, title: p.title },
    });
    if (count === 0) {
      await prisma.studentPortfolio.create({
        data: {
          studentProfileId: sp.id,
          title:            p.title,
          type:             p.type as any,
          description:      p.description,
          subjectId:        p.subjectCode ? subjects[p.subjectCode].id : undefined,
          startDate:        p.startDate,
          endDate:          p.endDate ?? undefined,
        },
      });
      log(`  portfolio: ${sp.fullName} — ${p.title}`);
    }
  }

  // ── 6. Achievements ───────────────────────────────────────────────────────────

  log('Upserting achievements...');

  const achievementSeed = [
    { idx: 0, title: 'Juara 1 Olimpiade Matematika Tingkat Kota',
      category: 'competition', level: 'city', organizer: 'Dinas Pendidikan Kota Bandung',
      eventName: 'Olimpiade Sains Kota 2024', achievedAt: new Date('2024-10-05'),
      rank: 'Juara 1', description: 'Meraih juara pertama dalam olimpiade matematika tingkat kota dengan nilai tertinggi.' },

    { idx: 1, title: 'Finalis Lomba Debat Bahasa Indonesia Tingkat Provinsi',
      category: 'academic', level: 'provincial', organizer: 'MGMP Bahasa Indonesia Jawa Barat',
      eventName: 'Lomba Debat Bahasa Indonesia 2024', achievedAt: new Date('2024-11-15'),
      rank: 'Finalis', description: 'Berhasil melaju hingga babak final dalam lomba debat bahasa Indonesia tingkat provinsi.' },

    { idx: 2, title: 'Juara 2 Lomba Basket Antar Sekolah',
      category: 'sports', level: 'city', organizer: 'PERBASI Kota Medan',
      eventName: 'Kompetisi Basket Pelajar 2024', achievedAt: new Date('2024-09-20'),
      rank: 'Juara 2', description: 'Membawa tim basket sekolah meraih juara kedua dalam kompetisi antar sekolah se-kota.' },

    { idx: 3, title: 'Juara 1 Lomba Karya Ilmiah Remaja Tingkat Nasional',
      category: 'academic', level: 'national', organizer: 'LIPI / BRIN',
      eventName: 'Lomba Karya Ilmiah Remaja (LKIR) 2024', achievedAt: new Date('2024-12-01'),
      rank: 'Juara 1', description: 'Meraih juara pertama dengan karya riset kimia pewarna alami, mewakili provinsi Jawa Barat.' },

    { idx: 4, title: 'Siswa Berprestasi Tingkat Sekolah',
      category: 'academic', level: 'school', organizer: 'SMA Negeri 1 Yogyakarta',
      eventName: 'Hari Guru Nasional 2024', achievedAt: new Date('2024-11-25'),
      rank: 'Terbaik 1', description: 'Dinobatkan sebagai siswa berprestasi kelas X semester ganjil 2024.' },

    { idx: 5, title: 'Juara 3 Olimpiade Kimia Tingkat Kota',
      category: 'competition', level: 'city', organizer: 'Dinas Pendidikan Kota Semarang',
      eventName: 'Olimpiade Kimia Kota Semarang 2024', achievedAt: new Date('2024-10-18'),
      rank: 'Juara 3', description: 'Meraih juara ketiga dalam olimpiade kimia mewakili sekolah di tingkat kota.' },

    { idx: 6, title: 'Juara 1 Lomba Fisika Eksperimen Tingkat Provinsi',
      category: 'competition', level: 'provincial', organizer: 'Himpunan Fisika Indonesia Wilayah Jawa Barat',
      eventName: 'Physics Experiment Competition 2024', achievedAt: new Date('2024-11-08'),
      rank: 'Juara 1', description: 'Berhasil meraih juara pertama dalam kompetisi eksperimen fisika tingkat provinsi.' },

    { idx: 7, title: 'Penghargaan Puisi Terbaik Festival Sastra Kota',
      category: 'arts', level: 'city', organizer: 'Dinas Kebudayaan Kota Makassar',
      eventName: 'Festival Sastra Kota Makassar 2024', achievedAt: new Date('2024-10-28'),
      rank: 'Terbaik', description: 'Meraih penghargaan puisi terbaik dalam festival sastra kota dengan karya berjudul "Jejak Digital".' },

    { idx: 8, title: 'Juara 2 Lomba Cerdas Cermat Matematika Tingkat Kota',
      category: 'competition', level: 'city', organizer: 'Dinas Pendidikan Kota Denpasar',
      eventName: 'Cerdas Cermat Matematika 2024', achievedAt: new Date('2024-09-14'),
      rank: 'Juara 2', description: 'Mewakili sekolah dalam lomba cerdas cermat matematika dan meraih posisi kedua tingkat kota.' },

    { idx: 9, title: 'Relawan Berprestasi PMR Tingkat Cabang',
      category: 'organization', level: 'district', organizer: 'PMI Cabang Malang',
      eventName: 'Pekan PMR Wira 2024', achievedAt: new Date('2024-11-02'),
      rank: 'Terbaik', description: 'Mendapat penghargaan relawan berprestasi dalam kegiatan PMR tingkat cabang Malang.' },

    // Additional cross-category achievements
    { idx: 0, title: 'Peserta Olimpiade Informatika Tingkat Provinsi',
      category: 'competition', level: 'provincial', organizer: 'Kemendikbud',
      eventName: 'OSN Informatika 2024', achievedAt: new Date('2024-09-02'),
      rank: 'Peserta', description: 'Lolos seleksi dan mewakili sekolah dalam Olimpiade Sains Nasional bidang Informatika.' },

    { idx: 2, title: 'Juara 1 Lomba Poster Fisika Kreatif',
      category: 'arts', level: 'school', organizer: 'SMAN 1 Medan',
      eventName: 'Pekan Sains 2024', achievedAt: new Date('2024-08-28'),
      rank: 'Juara 1', description: 'Meraih juara pertama dalam lomba poster fisika kreatif di acara pekan sains sekolah.' },
  ];

  for (const a of achievementSeed) {
    const sp    = studentProfiles[a.idx];
    const count = await prisma.studentAchievement.count({
      where: { studentProfileId: sp.id, title: a.title },
    });
    if (count === 0) {
      await prisma.studentAchievement.create({
        data: {
          studentProfileId: sp.id,
          title:            a.title,
          category:         a.category as any,
          level:            a.level as any,
          organizer:        a.organizer,
          eventName:        a.eventName,
          achievedAt:       a.achievedAt,
          rank:             a.rank,
          description:      a.description,
        },
      });
      log(`  achievement: ${sp.fullName} — ${a.title}`);
    }
  }

  // ── 7. Period templates & rows ─────────────────────────────────────────────

  log('Upserting period templates...');

  const periodTemplate = await prisma.periodTemplate.upsert({
    where: {
      gradeLevel_academicYear: {
        gradeLevel: 10,
        academicYear: '2025/2026',
      },
    },
    create: {
      gradeLevel: 10,
      academicYear: '2025/2026',
      dayStart: '07:00',
    },
    update: {
      dayStart: '07:00',
    },
  });

  const periodRowsSeed = [
    { sortOrder: 1, kind: 'lesson', label: 'Period 1', durationMin: 45, activeDays: [] as number[] },
    { sortOrder: 2, kind: 'lesson', label: 'Period 2', durationMin: 45, activeDays: [] as number[] },
    { sortOrder: 3, kind: 'break', label: 'Morning Break', durationMin: 15, activeDays: [1, 2, 3, 4, 5] },
    { sortOrder: 4, kind: 'lesson', label: 'Period 3', durationMin: 45, activeDays: [] as number[] },
    { sortOrder: 5, kind: 'lesson', label: 'Period 4', durationMin: 45, activeDays: [] as number[] },
  ];

  const periodRows: Array<{ id: string; sortOrder: number; label: string }> = [];
  for (const row of periodRowsSeed) {
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
        activeDays: row.activeDays,
      },
      update: {
        kind: row.kind as any,
        label: row.label,
        durationMin: row.durationMin,
        activeDays: row.activeDays,
      },
      select: { id: true, sortOrder: true, label: true },
    });
    periodRows.push(periodRow);
    log(`  period row: ${periodRow.label}`);
  }

  let cursor = 7 * 60;
  for (const row of periodRowsSeed) {
    log(`    ${row.label}: ${toTime(cursor)} - ${toTime(cursor + row.durationMin)}`);
    cursor += row.durationMin;
  }

  // ── 8. Schedule requirements ───────────────────────────────────────────────

  log('Upserting schedule requirements...');

  const requirementSeed = [
    {
      classroomId: classroom.id,
      subjectCode: 'MTK',
      teacherProfileId: teacherProfiles[0].id,
      roomId: rooms['Ruang A101'].id,
      sessionsPerWeek: 4,
    },
    {
      classroomId: classroom.id,
      subjectCode: 'BIN',
      teacherProfileId: teacherProfiles[1].id,
      roomId: rooms['Ruang A101'].id,
      sessionsPerWeek: 3,
    },
    {
      classroomId: classroom.id,
      subjectCode: 'FIS',
      teacherProfileId: teacherProfiles[2].id,
      roomId: rooms['Lab Fisika'].id,
      sessionsPerWeek: 2,
    },
    {
      classroomId: classroom2.id,
      subjectCode: 'KIM',
      teacherProfileId: teacherProfiles[3].id,
      roomId: rooms['Ruang A102'].id,
      sessionsPerWeek: 3,
    },
  ];

  for (const req of requirementSeed) {
    await prisma.scheduleRequirement.upsert({
      where: {
        classroomId_subjectId_academicYear_semester: {
          classroomId: req.classroomId,
          subjectId: subjects[req.subjectCode].id,
          academicYear: '2025/2026',
          semester: 1,
        },
      },
      create: {
        classroomId: req.classroomId,
        subjectId: subjects[req.subjectCode].id,
        teacherProfileId: req.teacherProfileId,
        roomId: req.roomId,
        sessionsPerWeek: req.sessionsPerWeek,
        academicYear: '2025/2026',
        semester: 1,
      },
      update: {
        teacherProfileId: req.teacherProfileId,
        roomId: req.roomId,
        sessionsPerWeek: req.sessionsPerWeek,
      },
    });
    log(`  requirement: ${subjects[req.subjectCode].name}`);
  }

  // ── 9. Schedule document & entries ─────────────────────────────────────────

  log('Upserting schedule document and entries...');

  const schedule = await prisma.schedule.upsert({
    where: {
      classroomId_academicYear_semester: {
        classroomId: classroom.id,
        academicYear: '2025/2026',
        semester: 1,
      },
    },
    create: {
      classroomId: classroom.id,
      academicYear: '2025/2026',
      semester: 1,
      status: 'draft',
    },
    update: {
      deletedAt: null,
      status: 'draft',
      archivedAt: null,
    },
  });

  const entrySeed = [
    {
      subjectCode: 'MTK',
      teacherProfileId: teacherProfiles[0].id,
      roomId: rooms['Ruang A101'].id,
      dayOfWeek: 1,
      periodSortOrder: 1,
      notes: 'Matematika Monday Period 1',
    },
    {
      subjectCode: 'BIN',
      teacherProfileId: teacherProfiles[1].id,
      roomId: rooms['Ruang A101'].id,
      dayOfWeek: 1,
      periodSortOrder: 2,
      notes: 'Bahasa Indonesia Monday Period 2',
    },
    {
      subjectCode: 'FIS',
      teacherProfileId: teacherProfiles[2].id,
      roomId: rooms['Lab Fisika'].id,
      dayOfWeek: undefined,
      periodSortOrder: undefined,
      notes: 'Tray item for later placement',
    },
  ];

  for (const entry of entrySeed) {
    const periodRow = entry.periodSortOrder
      ? periodRows.find((row) => row.sortOrder === entry.periodSortOrder)
      : undefined;

    const existing = await prisma.scheduleEntry.findFirst({
      where: {
        scheduleId: schedule.id,
        subjectId: subjects[entry.subjectCode].id,
        teacherProfileId: entry.teacherProfileId,
        dayOfWeek: entry.dayOfWeek ?? null,
        periodRowId: periodRow?.id ?? null,
        deletedAt: null,
      },
    });

    if (!existing) {
      await prisma.scheduleEntry.create({
        data: {
          scheduleId: schedule.id,
          subjectId: subjects[entry.subjectCode].id,
          teacherProfileId: entry.teacherProfileId,
          roomId: entry.roomId,
          dayOfWeek: entry.dayOfWeek,
          periodRowId: periodRow?.id,
          notes: entry.notes,
        },
      });
    }
    log(`  schedule entry: ${subjects[entry.subjectCode].name}`);
  }

  const publishedSchedule = await prisma.schedule.upsert({
    where: {
      classroomId_academicYear_semester: {
        classroomId: classroom2.id,
        academicYear: '2025/2026',
        semester: 1,
      },
    },
    create: {
      classroomId: classroom2.id,
      academicYear: '2025/2026',
      semester: 1,
      status: 'published',
      publishedAt: new Date(),
    },
    update: {
      status: 'published',
      publishedAt: new Date(),
      deletedAt: null,
      archivedAt: null,
    },
  });

  const publishedEntry = await prisma.scheduleEntry.findFirst({
    where: {
      scheduleId: publishedSchedule.id,
      subjectId: subjects.KIM.id,
      teacherProfileId: teacherProfiles[3].id,
      dayOfWeek: 2,
      deletedAt: null,
    },
  });
  if (!publishedEntry) {
    await prisma.scheduleEntry.create({
      data: {
        scheduleId: publishedSchedule.id,
        subjectId: subjects.KIM.id,
        teacherProfileId: teacherProfiles[3].id,
        roomId: rooms['Ruang A102'].id,
        dayOfWeek: 2,
        periodRowId: periodRows[0].id,
        notes: 'Published seed schedule',
      },
    });
  }

  // ── 10. Teacher unavailability ─────────────────────────────────────────────

  log('Upserting teacher unavailability...');

  const unavailability = await prisma.teacherUnavailability.findUnique({
    where: {
      teacherProfileId_dayOfWeek_periodRowId: {
        teacherProfileId: teacherProfiles[2].id,
        dayOfWeek: 3,
        periodRowId: periodRows[1].id,
      },
    },
  });
  if (!unavailability) {
    await prisma.teacherUnavailability.create({
      data: {
        teacherProfileId: teacherProfiles[2].id,
        dayOfWeek: 3,
        periodRowId: periodRows[1].id,
        reason: 'Dummy unavailable slot',
      },
    });
  }

  // ── Done ─────────────────────────────────────────────────────────────────────

  await prisma.$disconnect();

  log(`\n✓ Seed complete for schema: ${schema}`);
  log(`  ${teacherProfiles.length} teachers`);
  log(`  ${studentProfiles.length} students`);
  log(`  ${portfolioSeed.length} portfolios`);
  log(`  ${achievementSeed.length} achievements`);
  log(`  periodTemplateId: ${periodTemplate.id}`);
  log(`  scheduleId: ${schedule.id}`);
  log(`  classroomId: ${classroom.id}`);
  log(`  classroom2Id: ${classroom2.id}`);
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
