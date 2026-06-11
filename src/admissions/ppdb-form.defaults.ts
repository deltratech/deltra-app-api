export type PpdbFieldType = 'text' | 'textarea' | 'date' | 'tel' | 'email' | 'select';

export interface PpdbField {
  key: string;
  label: string;
  type: PpdbFieldType;
  required: boolean;
  enabled: boolean;
  system: boolean;       // maps to an AdmissionApplication column; cannot be deleted
  locked?: boolean;      // required for the application to be created; can't be disabled
  options?: string[];    // for select
}

export interface PpdbRequiredDoc {
  key: string;
  label: string;
  required: boolean;
}

/** System field keys mapped to AdmissionApplication columns. Anything else → formData. */
export const SYSTEM_FIELD_KEYS = [
  'applicantName', 'schoolLevel', 'gradeLabel', 'birthDate', 'gender',
  'applicantNik', 'guardianName', 'guardianPhone', 'guardianEmail',
] as const;

export const DEFAULT_FIELDS: PpdbField[] = [
  { key: 'applicantName',  label: 'Full name',           type: 'text',   required: true,  enabled: true, system: true, locked: true },
  { key: 'schoolLevel',    label: 'School level',        type: 'select', required: true,  enabled: true, system: true, locked: true },
  { key: 'gradeLabel',     label: 'Grade applying for',  type: 'select', required: true,  enabled: true, system: true, locked: true },
  { key: 'birthDate',      label: 'Date of birth',       type: 'date',   required: false, enabled: true, system: true },
  { key: 'gender',         label: 'Gender',              type: 'select', required: false, enabled: true, system: true, options: ['male', 'female'] },
  { key: 'applicantNik',   label: 'NIK',                 type: 'text',   required: false, enabled: true, system: true },
  { key: 'guardianName',   label: 'Parent / guardian name',  type: 'text',  required: false, enabled: true, system: true },
  { key: 'guardianPhone',  label: 'Parent phone / WhatsApp', type: 'tel',   required: false, enabled: true, system: true },
  { key: 'guardianEmail',  label: 'Parent email',            type: 'email', required: false, enabled: true, system: true },
];

export const DEFAULT_REQUIRED_DOCS: PpdbRequiredDoc[] = [
  { key: 'kk',    label: 'Kartu Keluarga (KK)',           required: true },
  { key: 'akta',  label: 'Akta Kelahiran',                required: true },
  { key: 'rapor', label: 'Rapor SD/SMP (2 semester)',     required: true },
  { key: 'foto',  label: 'Foto 3×4 (2 lembar)',           required: true },
  { key: 'skl',   label: 'Surat Keterangan Lulus',        required: true },
];
