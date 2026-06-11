import { UserRole } from '../common/enums/user-role.enum';

/**
 * Official school document (SK / Surat) categories and their workflow rules.
 *
 * This is the single source of truth for who creates, approves and signs each
 * category, and what side-effect signing applies. The workflow engine reads it
 * to gate actions by role and to dispatch side-effects on sign.
 */

export enum DocumentCategory {
  // Employment contracts
  kontrak_guru_pkwt = 'kontrak_guru_pkwt',
  kontrak_staff = 'kontrak_staff',
  pkwtt = 'pkwtt',
  perpanjangan_kontrak = 'perpanjangan_kontrak',
  // Employment appointment letters
  sk_guru_tetap = 'sk_guru_tetap',
  sk_guru_kontrak = 'sk_guru_kontrak',
  sk_staff_tetap = 'sk_staff_tetap',
  sk_staff_kontrak = 'sk_staff_kontrak',
  // Position assignment letters
  sk_kepala_sekolah = 'sk_kepala_sekolah',
  sk_wakasek = 'sk_wakasek',
  sk_koordinator_kurikulum = 'sk_koordinator_kurikulum',
  // Teaching assignment letters
  sk_tugas_mengajar = 'sk_tugas_mengajar',
  sk_wali_kelas = 'sk_wali_kelas',
}

export type DocumentGroup = 'employment_contract' | 'employment_appointment' | 'position_assignment' | 'teaching_assignment';

export type RecipientType = 'teacher' | 'staff' | 'principal';

/** Side-effect applied when a document is signed (made active). */
export type DocumentSideEffect =
  | 'teaching_assignment'
  | 'homeroom'
  | 'employment_status'
  | 'position'
  | 'transfer'
  | 'none';

export interface CategoryConfig {
  label: string;
  group: DocumentGroup;
  recipientType: RecipientType;
  creatorRoles: UserRole[];
  approverRole: UserRole;
  signerRole: UserRole;
  sideEffect: DocumentSideEffect;
  /** False = recognized but not yet implemented end-to-end (stubbed). */
  enabled: boolean;
}

const SCHOOL_ADMIN = UserRole.school_admin;
const PRINCIPAL = UserRole.principal;
const YAYASAN = UserRole.network_admin; // Ketua Yayasan / foundation level

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, CategoryConfig> = {
  [DocumentCategory.kontrak_guru_pkwt]: {
    label: 'Kontrak Guru (PKWT)',
    group: 'employment_contract',
    recipientType: 'teacher',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'none',
    enabled: true,
  },
  [DocumentCategory.kontrak_staff]: {
    label: 'Kontrak Staff',
    group: 'employment_contract',
    recipientType: 'staff',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'none',
    enabled: true,
  },
  [DocumentCategory.pkwtt]: {
    label: 'PKWTT',
    group: 'employment_contract',
    recipientType: 'staff',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'none',
    enabled: true,
  },
  [DocumentCategory.perpanjangan_kontrak]: {
    label: 'Perpanjangan Kontrak',
    group: 'employment_contract',
    recipientType: 'staff',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'none',
    enabled: true,
  },
  [DocumentCategory.sk_guru_tetap]: {
    label: 'SK Guru Tetap',
    group: 'employment_appointment',
    recipientType: 'teacher',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'employment_status',
    enabled: true,
  },
  [DocumentCategory.sk_guru_kontrak]: {
    label: 'SK Guru Kontrak',
    group: 'employment_appointment',
    recipientType: 'teacher',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'employment_status',
    enabled: true,
  },
  [DocumentCategory.sk_staff_tetap]: {
    label: 'SK Staff Tetap',
    group: 'employment_appointment',
    recipientType: 'staff',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'employment_status',
    enabled: true,
  },
  [DocumentCategory.sk_staff_kontrak]: {
    label: 'SK Staff Kontrak',
    group: 'employment_appointment',
    recipientType: 'staff',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'employment_status',
    enabled: true,
  },
  [DocumentCategory.sk_kepala_sekolah]: {
    label: 'SK Kepala Sekolah',
    group: 'position_assignment',
    recipientType: 'principal',
    creatorRoles: [SCHOOL_ADMIN, YAYASAN],
    approverRole: YAYASAN,
    signerRole: YAYASAN,
    sideEffect: 'position',
    enabled: true,
  },
  [DocumentCategory.sk_wakasek]: {
    label: 'SK Wakil Kepala Sekolah',
    group: 'position_assignment',
    recipientType: 'staff',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: PRINCIPAL,
    signerRole: PRINCIPAL,
    sideEffect: 'position',
    enabled: true,
  },
  [DocumentCategory.sk_koordinator_kurikulum]: {
    label: 'SK Koordinator Kurikulum',
    group: 'position_assignment',
    recipientType: 'staff',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: PRINCIPAL,
    signerRole: PRINCIPAL,
    sideEffect: 'position',
    enabled: true,
  },
  [DocumentCategory.sk_tugas_mengajar]: {
    label: 'SK Tugas Mengajar',
    group: 'teaching_assignment',
    recipientType: 'teacher',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: PRINCIPAL,
    signerRole: PRINCIPAL,
    sideEffect: 'teaching_assignment',
    enabled: true,
  },
  [DocumentCategory.sk_wali_kelas]: {
    label: 'SK Wali Kelas',
    group: 'teaching_assignment',
    recipientType: 'teacher',
    creatorRoles: [SCHOOL_ADMIN],
    approverRole: PRINCIPAL,
    signerRole: PRINCIPAL,
    sideEffect: 'homeroom',
    enabled: true,
  },
};

// ── Signature slots ───────────────────────────────────────────────────────────

/** Who fills a signature slot. 'manual' = signed offline (image/name supplied by admin). */
export type SignatureSlotRole = 'principal' | 'network_admin' | 'recipient' | 'school_admin' | 'manual';

export interface SignatureSlot {
  key: string;            // the DOCX image-tag name, e.g. "eSignature" / "ttd_kepsek"
  role: SignatureSlotRole;
  label?: string;
}

export const SIGNATURE_SLOT_ROLES: SignatureSlotRole[] = ['principal', 'network_admin', 'recipient', 'school_admin', 'manual'];

/** Best-effort default signer for a detected slot, inferred from its tag name. */
export function guessSlotRole(key: string): SignatureSlotRole {
  const k = key.toLowerCase();
  if (/(kepsek|kepala|principal)/.test(k)) return 'principal';
  if (/(yayasan|ketua|foundation)/.test(k)) return 'network_admin';
  if (/(guru|teacher|pegawai|penerima|recipient|staff)/.test(k)) return 'recipient';
  return 'principal';
}

// ── Recipient + approver config (per-template, editable at generate) ───────────

export const RECIPIENT_TYPES: RecipientType[] = ['teacher', 'principal', 'staff'];

/** Roles that can be required to approve a document. */
export type ApproverRole = 'network_admin' | 'principal' | 'teacher';
export const APPROVER_ROLES: ApproverRole[] = ['network_admin', 'principal', 'teacher'];

export function getCategoryConfig(category: DocumentCategory): CategoryConfig {
  return DOCUMENT_CATEGORIES[category];
}

export function isCategoryEnabled(category: DocumentCategory): boolean {
  return DOCUMENT_CATEGORIES[category]?.enabled === true;
}
