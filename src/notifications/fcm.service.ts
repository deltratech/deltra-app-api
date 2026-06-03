import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as admin from 'firebase-admin';
import { FcmWebConfigDto } from './dto/fcm-web-config.dto';

const DEFAULT_SERVICE_ACCOUNT_FILE = 'platform-notifications-9c840-firebase-adminsdk-fbsvc-38ffee63b9.json';

export type SendFcmMessageInput = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class FcmService {
  private app?: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  async send(input: SendFcmMessageInput): Promise<string> {
    const app = this.getApp();
    return app.messaging().send({
      token: input.token,
      notification: {
        title: input.title,
        body: input.body,
      },
      data: input.data,
      webpush: {
        notification: {
          title: input.title,
          body: input.body,
        },
      },
    });
  }

  getWebConfig(): FcmWebConfigDto {
    return {
      apiKey: this.config.getOrThrow<string>('FCM_API_KEY'),
      authDomain: this.config.getOrThrow<string>('FCM_AUTH_DOMAIN'),
      projectId: this.config.getOrThrow<string>('FCM_PROJECT_ID'),
      storageBucket: this.config.getOrThrow<string>('FCM_STORAGE_BUCKET'),
      messagingSenderId: this.config.getOrThrow<string>('FCM_MESSAGING_SENDER_ID'),
      appId: this.config.getOrThrow<string>('FCM_APP_ID'),
      measurementId: this.config.get<string>('FCM_MEASUREMENT_ID'),
      vapidKey: this.config.get<string>('FCM_CERTI_KEY_PAIR'),
    };
  }

  private getApp() {
    if (this.app) return this.app;

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID') ?? this.config.get<string>('FCM_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = (
      this.config.get<string>('FIREBASE_PRIVATE_KEY') ?? this.config.get<string>('FCM_CERTI_PRIVATE_KEY')
    )?.replace(/\\n/g, '\n');

    if (!projectId) {
      throw new InternalServerErrorException('Firebase FCM project ID is not configured');
    }

    this.app = admin.apps.length
      ? admin.apps[0]!
      : admin.initializeApp(
          clientEmail && privateKey
            ? { credential: admin.credential.cert({ projectId, clientEmail, privateKey }) }
            : { projectId, credential: this.resolveCredential() },
        );

    return this.app;
  }

  private resolveCredential() {
    const configuredPath = this.config.get<string>('FCM_SERVICE_ACCOUNT_PATH');
    const serviceAccountPath = resolve(process.cwd(), configuredPath ?? DEFAULT_SERVICE_ACCOUNT_FILE);

    if (existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as admin.ServiceAccount;
      return admin.credential.cert(serviceAccount);
    }

    return admin.credential.applicationDefault();
  }
}
