CREATE TYPE "announcement_audience_type" AS ENUM ('school', 'grade', 'class');
CREATE TYPE "announcement_channel" AS ENUM ('in_app', 'whatsapp', 'email');
CREATE TYPE "announcement_status" AS ENUM ('draft', 'scheduled', 'sent', 'cancelled');
CREATE TYPE "announcement_delivery_status" AS ENUM ('pending', 'queued', 'sent', 'failed');
CREATE TYPE "announcement_template_category" AS ENUM ('school_holiday', 'parent_meeting', 'exam');

CREATE TABLE "announcements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience_type" "announcement_audience_type" NOT NULL,
  "target_grade_level" SMALLINT,
  "target_classroom_id" UUID,
  "channels" "announcement_channel"[] NOT NULL DEFAULT ARRAY[]::"announcement_channel"[],
  "status" "announcement_status" NOT NULL DEFAULT 'draft',
  "scheduled_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID NOT NULL,
  "student_profile_id" UUID NOT NULL,
  "guardian_id" UUID,
  "recipient_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_delivery_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "channel" "announcement_channel" NOT NULL,
  "status" "announcement_delivery_status" NOT NULL DEFAULT 'pending',
  "destination" TEXT,
  "provider" TEXT,
  "error" TEXT,
  "sent_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "announcement_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category" "announcement_template_category" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "announcement_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID,
  "actor_user_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_audience_type_target_grade_level_idx" ON "announcements"("audience_type", "target_grade_level");
CREATE INDEX "announcements_target_classroom_id_idx" ON "announcements"("target_classroom_id");
CREATE INDEX "announcements_status_scheduled_at_idx" ON "announcements"("status", "scheduled_at");
CREATE INDEX "announcements_pinned_created_at_idx" ON "announcements"("pinned", "created_at");
CREATE UNIQUE INDEX "announcement_recipients_announcement_id_recipient_key_key" ON "announcement_recipients"("announcement_id", "recipient_key");
CREATE INDEX "announcement_recipients_student_profile_id_read_at_idx" ON "announcement_recipients"("student_profile_id", "read_at");
CREATE UNIQUE INDEX "announcement_delivery_logs_recipient_id_channel_key" ON "announcement_delivery_logs"("recipient_id", "channel");
CREATE INDEX "announcement_delivery_logs_announcement_id_channel_status_idx" ON "announcement_delivery_logs"("announcement_id", "channel", "status");
CREATE INDEX "announcement_templates_category_is_active_idx" ON "announcement_templates"("category", "is_active");
CREATE INDEX "announcement_audit_logs_announcement_id_created_at_idx" ON "announcement_audit_logs"("announcement_id", "created_at");
CREATE INDEX "announcement_audit_logs_actor_user_id_created_at_idx" ON "announcement_audit_logs"("actor_user_id", "created_at");

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_classroom_id_fkey" FOREIGN KEY ("target_classroom_id") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcement_delivery_logs" ADD CONSTRAINT "announcement_delivery_logs_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_delivery_logs" ADD CONSTRAINT "announcement_delivery_logs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "announcement_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_audit_logs" ADD CONSTRAINT "announcement_audit_logs_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcement_audit_logs" ADD CONSTRAINT "announcement_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "announcement_templates" ("category", "title", "body", "updated_at") VALUES
  ('school_holiday', 'Pengumuman Libur Sekolah', 'Yth. Bapak/Ibu Orang Tua/Wali, kegiatan belajar mengajar diliburkan pada {tanggal} dalam rangka {keterangan}. Kegiatan belajar kembali aktif pada {tanggal_masuk}. Terima kasih.', CURRENT_TIMESTAMP),
  ('parent_meeting', 'Undangan Rapat Orang Tua', 'Yth. Bapak/Ibu Orang Tua/Wali, kami mengundang kehadiran Bapak/Ibu pada rapat orang tua yang akan dilaksanakan pada {tanggal} pukul {waktu} di {lokasi}. Terima kasih.', CURRENT_TIMESTAMP),
  ('exam', 'Informasi Ujian', 'Yth. Bapak/Ibu Orang Tua/Wali, ujian {nama_ujian} akan dilaksanakan pada {tanggal_mulai} sampai {tanggal_selesai}. Mohon mendampingi persiapan belajar ananda. Terima kasih.', CURRENT_TIMESTAMP);
