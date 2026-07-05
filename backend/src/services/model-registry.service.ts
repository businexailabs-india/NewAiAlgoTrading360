import { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export class ModelRegistryService {
  private static client(): S3Client | null {
    if (!process.env.AWS_S3_DATA_BUCKET) return null;
    return new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
  }

  static async uploadAdapter(userId: string, jobId: string, localDir: string): Promise<string | undefined> {
    const bucket = process.env.AWS_S3_DATA_BUCKET;
    if (!bucket || !fs.existsSync(localDir)) return localDir;

    const s3 = this.client();
    if (!s3) return localDir;

    const prefix = `llm-adapters/${userId}/${jobId}`;
    const files = fs.readdirSync(localDir);

    for (const file of files) {
      const full = path.join(localDir, file);
      if (!fs.statSync(full).isFile()) continue;
      const body = fs.readFileSync(full);
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/${file}`,
        Body: body,
        ContentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      }));
    }

    const s3Path = `s3://${bucket}/${prefix}`;
    logger.info(`Adapter uploaded to ${s3Path}`);
    return s3Path;
  }
}
