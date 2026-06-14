/**
 * Tenant Seed — default teacher-contract templates (SK documents).
 *
 * Seeds the three standard Indonesian school-decree DOCX templates so they appear
 * in Admin → Contracts → Templates without a manual upload. For each template it:
 *   1. extracts the docxtemplater variable keys from the .docx (same regex the API uses),
 *   2. uploads the file to MinIO under `shared/teacher-contract-templates/` (same as the API),
 *   3. upserts a ContractTemplate row scoped to the tenant schema.
 *
 * Idempotent: re-running skips templates that already exist (matched by name+type+version).
 *
 * Usage:
 *   SEED_SCHEMA=tenant_sma_test npx ts-node --project tsconfig.seed.json prisma/tenant/seed-contract-templates.ts
 *
 * MinIO connection mirrors StorageService defaults; override with MINIO_ENDPOINT,
 * MINIO_PUBLIC_URL, MINIO_BUCKET, MINIO_USER, MINIO_PASSWORD. Run inside the api container
 * (or with the same env) so the stored templateFileUrl matches MINIO_PUBLIC_URL the app reads.
 * From the host, point MINIO_ENDPOINT at the published port, e.g. http://localhost:9000.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import PizZip from 'pizzip';
import { PrismaClient } from '../../src/generated/tenant-client';
import { tenantSeedUrl } from './seed-url';

// ── Connection ──────────────────────────────────────────────────────────────

const schema = process.env.SEED_SCHEMA ?? 'tenant_sma_test';
const prisma = new PrismaClient({ datasources: { db: { url: tenantSeedUrl(schema) } } });

function log(msg: string) { console.log(`[seed:contracts] ${msg}`); }

// ── MinIO (mirrors StorageService) ────────────────────────────────────────────

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FOLDER = 'teacher-contract-templates';
const SHARED_TENANT = 'shared';

const bucket = process.env.MINIO_BUCKET ?? 'deltra-uploads';
const publicUrl = (process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000').replace(/\/$/, '');

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_USER ?? 'deltra',
    secretAccessKey: process.env.MINIO_PASSWORD ?? 'deltra123',
  },
  forcePathStyle: true,
});

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    await s3.send(new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/*`] }],
      }),
    }));
    log(`bucket "${bucket}" created and set to public-read`);
  }
}

async function uploadDocx(buffer: Buffer): Promise<string> {
  const key = `${SHARED_TENANT}/${FOLDER}/${randomUUID()}.docx`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: DOCX_MIME }));
  return `${publicUrl}/${bucket}/${key}`;
}

// ── Variable extraction (mirrors ContractsService.extractDocxVariableKeys) ──

function extractVariableKeys(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const pattern = /\{[%#/^@]?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}/g;
  const keys = new Set<string>();
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue;
    const text = zip.files[name].asText().replace(/<[^>]+>/g, '');
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) keys.add(m[1]);
  }
  return [...keys];
}

// ── Templates ──────────────────────────────────────────────────────────────

const ASSET_DIR = join(__dirname, 'assets', 'contract-templates');

const TEMPLATES: Array<{ name: string; file: string }> = [
  { name: 'SK Pengangkatan Guru Tetap (GTY)', file: 'SK-GTY-Guru.docx' },
  { name: 'SK Tugas Mengajar',                file: 'SK-Tugas-Mengajar.docx' },
  { name: 'SK Pengangkatan Kepala Sekolah',   file: 'SK-Kepsek-Yayasan.docx' },
];

async function main() {
  await ensureBucket();

  let created = 0;
  let skipped = 0;

  for (const tpl of TEMPLATES) {
    const existing = await prisma.contractTemplate.findFirst({
      where: { deletedAt: null, name: tpl.name, version: 1 },
    });
    if (existing) {
      skipped++;
      log(`exists, skipping: ${tpl.name}`);
      continue;
    }

    const buffer = readFileSync(join(ASSET_DIR, tpl.file));
    const variableKeys = extractVariableKeys(buffer);
    if (variableKeys.length === 0) throw new Error(`${tpl.file} has no template variables`);

    const templateFileUrl = await uploadDocx(buffer);

    await prisma.contractTemplate.create({
      data: {
        name: tpl.name,
        variablesJson: variableKeys as any,
        templateFileUrl,
        templateFileName: tpl.file,
        templateMimeType: DOCX_MIME,
        templateSizeBytes: buffer.length,
        version: 1,
        isActive: true,
      },
    });
    created++;
    log(`created: ${tpl.name} — ${variableKeys.length} variables`);
  }

  log(`\n✓ Contract template seed complete for schema: ${schema}`);
  log(`  ${created} created, ${skipped} skipped`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
