-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('school_admin', 'principal', 'finance', 'teacher', 'student');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('active', 'transferred', 'graduated', 'dropped');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('male', 'female');

-- CreateTable
CREATE TABLE "users" (
    "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
    "email"         TEXT            NOT NULL,
    "phone"         TEXT,
    "password_hash" TEXT,
    "full_name"     TEXT            NOT NULL,
    "avatar_url"    TEXT,
    "role"          "user_role"     NOT NULL,
    "status"        "user_status"   NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at"    TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ(6)  NOT NULL,
    "deleted_at"    TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id"           UUID            NOT NULL DEFAULT gen_random_uuid(),
    "user_id"      UUID            NOT NULL,
    "nisn"         TEXT,
    "birth_date"   DATE,
    "birth_place"  TEXT,
    "gender"       "gender",
    "religion"     TEXT,
    "address"      TEXT,
    "phone"        TEXT,
    "photo_url"    TEXT,
    "entry_year"   SMALLINT,
    "parent_name"  TEXT,
    "parent_phone" TEXT,
    "parent_email" TEXT,
    "created_at"   TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ(6)  NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id"         UUID            NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID            NOT NULL,
    "nuptk"      TEXT,
    "bio"        TEXT,
    "created_at" TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6)  NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id"               UUID            NOT NULL DEFAULT gen_random_uuid(),
    "name"             TEXT            NOT NULL,
    "grade_level"      SMALLINT        NOT NULL,
    "academic_year"    TEXT            NOT NULL,
    "semester"         SMALLINT        NOT NULL,
    "homeroom_user_id" UUID,
    "created_at"       TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMPTZ(6)  NOT NULL,
    "deleted_at"       TIMESTAMPTZ(6),

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
    "code"        TEXT,
    "name"        TEXT            NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ(6)  NOT NULL,
    "deleted_at"  TIMESTAMPTZ(6),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_subjects" (
    "id"                 UUID  NOT NULL DEFAULT gen_random_uuid(),
    "classroom_id"       UUID  NOT NULL,
    "subject_id"         UUID  NOT NULL,
    "teacher_profile_id" UUID,

    CONSTRAINT "class_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id"                 UUID                NOT NULL DEFAULT gen_random_uuid(),
    "student_profile_id" UUID                NOT NULL,
    "classroom_id"       UUID                NOT NULL,
    "enrolled_at"        TIMESTAMPTZ(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"             "enrollment_status" NOT NULL DEFAULT 'active',

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_user_id_key" ON "teacher_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_name_academic_year_semester_key"
    ON "classrooms"("name", "academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "class_subjects_classroom_id_subject_id_key"
    ON "class_subjects"("classroom_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_profile_id_classroom_id_key"
    ON "enrollments"("student_profile_id", "classroom_id");

-- AddForeignKey
ALTER TABLE "student_profiles"
    ADD CONSTRAINT "student_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects"
    ADD CONSTRAINT "class_subjects_classroom_id_fkey"
    FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects"
    ADD CONSTRAINT "class_subjects_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects"
    ADD CONSTRAINT "class_subjects_teacher_profile_id_fkey"
    FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_student_profile_id_fkey"
    FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_classroom_id_fkey"
    FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
