// String enums mirroring the Prisma admission_* enums, for DTO validation + typing.
export enum AdmissionSchoolLevel {
  preschool = 'preschool',
  primary = 'primary',
  secondary = 'secondary',
}

export enum AdmissionStudentCategory {
  kf_student = 'kf_student',
  non_kf = 'non_kf',
  not_applicable = 'not_applicable',
}

export enum AdmissionKfStatusSource {
  system_derived = 'system_derived',
  manual_verified = 'manual_verified',
  unverified = 'unverified',
  not_applicable = 'not_applicable',
}

export enum AdmissionDocStatus {
  pending = 'pending',
  verified = 'verified',
  rejected = 'rejected',
}

export enum AdmissionDocType {
  kf_proof = 'kf_proof',
  birth_certificate = 'birth_certificate',
  family_card = 'family_card',
  photo = 'photo',
  test_result = 'test_result',
  other = 'other',
}

export enum AdmissionFeeType {
  application = 'application',
  test = 'test',
  psychotest = 'psychotest',
  registration = 'registration',
  admission = 'admission',
  development = 'development',
  tuition = 'tuition',
  activities = 'activities',
  books = 'books',
  uniform = 'uniform',
  other = 'other',
}

export enum AdmissionPaymentTerm {
  one_time = 'one_time',
  upon_registration = 'upon_registration',
  upon_admission = 'upon_admission',
  monthly = 'monthly',
  per_term = 'per_term',
  per_semester = 'per_semester',
  yearly = 'yearly',
}

export enum AdmissionInvoiceStatus {
  draft = 'draft',
  sent = 'sent',
  paid = 'paid',
  overdue = 'overdue',
  cancelled = 'cancelled',
}
