import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

const PREFIX = 'historical/';

export class S3StorageService {
  private static client: S3Client | null = null;

  static isEnabled(): boolean {
    return Boolean(process.env.AWS_S3_DATA_BUCKET);
  }

  static getBucket(): string {
    return process.env.AWS_S3_DATA_BUCKET || '';
  }

  private static getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: process.env.AWS_REGION || 'ap-south-1'
      });
    }
    return this.client;
  }

  static async checkConnection(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    try {
      await this.getClient().send(new HeadBucketCommand({ Bucket: this.getBucket() }));
      return true;
    } catch {
      return false;
    }
  }

  static keyForSymbol(symbol: string): string {
    return `${PREFIX}${symbol}.json`;
  }

  static manifestKey(): string {
    return `${PREFIX}manifest.json`;
  }

  static async getObject(key: string): Promise<string | null> {
    if (!this.isEnabled()) return null;
    try {
      const res = await this.getClient().send(new GetObjectCommand({
        Bucket: this.getBucket(),
        Key: key
      }));
      return await res.Body?.transformToString() || null;
    } catch (err: unknown) {
      const code = (err as { name?: string })?.name;
      if (code === 'NoSuchKey' || code === 'NotFound') return null;
      logger.warn(`S3 getObject failed for ${key}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  static async putObject(key: string, body: string): Promise<void> {
    if (!this.isEnabled()) return;
    await this.getClient().send(new PutObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
      Body: body,
      ContentType: 'application/json'
    }));
  }

  static async listSymbolKeys(): Promise<string[]> {
    if (!this.isEnabled()) return [];
    const keys: string[] = [];
    let token: string | undefined;

    do {
      const res = await this.getClient().send(new ListObjectsV2Command({
        Bucket: this.getBucket(),
        Prefix: PREFIX,
        ContinuationToken: token
      }));
      for (const obj of res.Contents || []) {
        if (obj.Key?.endsWith('.json') && obj.Key !== this.manifestKey()) {
          keys.push(obj.Key);
        }
      }
      token = res.NextContinuationToken;
    } while (token);

    return keys;
  }
}
