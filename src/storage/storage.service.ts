import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private static readonly DEFAULT_ENDPOINT = 'http://minio:9000';
  private static readonly DEFAULT_PUBLIC_URL = 'http://localhost:9000';
  private static readonly DEFAULT_USER = 'deltra';
  private static readonly DEFAULT_PASSWORD = 'deltra123';
  private static readonly DEFAULT_BUCKET = 'deltra-uploads';
  private client!: S3Client;
  private bucket!: string;
  private publicUrl!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const endpoint = this.getConfigWithDefault(
      'MINIO_ENDPOINT',
      StorageService.DEFAULT_ENDPOINT,
    );
    this.bucket = this.getConfigWithDefault(
      'MINIO_BUCKET',
      StorageService.DEFAULT_BUCKET,
    );
    this.publicUrl = this.getConfigWithDefault(
      'MINIO_PUBLIC_URL',
      StorageService.DEFAULT_PUBLIC_URL,
    );
    const accessKeyId = this.getConfigWithDefault(
      'MINIO_USER',
      StorageService.DEFAULT_USER,
    );
    const secretAccessKey = this.getConfigWithDefault(
      'MINIO_PASSWORD',
      StorageService.DEFAULT_PASSWORD,
    );

    this.client = new S3Client({
      endpoint,
      region: 'us-east-1', // MinIO requires any non-empty region
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // required for MinIO
    });

    await this.ensureBucket();
  }

  /**
   * Upload a file and return its public URL.
   * key format: {tenantSlug}/{folder}/{uuid}{ext}
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    folder: string,
    tenantSlug: string,
    objectName?: string,
  ): Promise<string> {
    const ext = extname(originalName).toLowerCase() || '.bin';
    const safeObjectName = objectName
      ? objectName.replace(/[^a-zA-Z0-9._-]+/g, '-')
      : `${randomUUID()}${ext}`;
    const key = `${tenantSlug}/${folder}/${safeObjectName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        buffer,
        ContentType: mimetype,
      }),
    );

    return `${this.publicUrl}/${this.bucket}/${key}`;
  }

  /** Delete a file by its full public URL. */
  async delete(url: string): Promise<void> {
    const prefix = `${this.publicUrl}/${this.bucket}/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Read file bytes by its full public URL. */
  async read(url: string): Promise<Buffer> {
    const prefix = `${this.publicUrl}/${this.bucket}/`;
    if (!url.startsWith(prefix)) {
      throw new Error('Invalid storage URL');
    }
    const key = url.slice(prefix.length);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error('Storage object body is empty');
    return Buffer.from(bytes);
  }

  // ── Setup ────────────────────────────────────────────────────────────────────

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      // Make bucket publicly readable so URLs work without auth
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect:    'Allow',
              Principal: '*',
              Action:    ['s3:GetObject'],
              Resource:  [`arn:aws:s3:::${this.bucket}/*`],
            }],
          }),
        }),
      );
      this.logger.log(`Bucket "${this.bucket}" created and set to public-read`);
    }
  }

  private getConfigWithDefault(key: string, fallback: string): string {
    const value = this.config.get<string>(key);
    if (value) return value;

    this.logger.warn(
      `Configuration key "${key}" is missing. Falling back to "${fallback}".`,
    );
    return fallback;
  }
}
