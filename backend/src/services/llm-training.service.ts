import axios from 'axios';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { ModelRegistryService } from './model-registry.service';
import { logger } from '../utils/logger';

const llmUrl = () => process.env.LLM_SERVICE_URL || 'http://localhost:8082';

export class LlmTrainingService {
  static async listJobs(userId: string) {
    return prisma.llmTrainingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  static async listAdapters(userId: string) {
    return prisma.llmAdapter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async startTraining(
    userId: string,
    data: {
      name: string;
      baseModel?: string;
      trainType?: 'lora' | 'qlora';
      config?: Record<string, unknown>;
      dataset?: Array<{ instruction: string; input?: string; output: string }>;
    }
  ) {
    const job = await prisma.llmTrainingJob.create({
      data: {
        userId,
        name: data.name,
        baseModel: data.baseModel || process.env.LLM_BASE_MODEL || 'sshleifer/tiny-gpt2',
        trainType: data.trainType || 'qlora',
        status: 'queued',
        config: (data.config || {}) as object
      }
    });

    const dataset = data.dataset?.length
      ? data.dataset
      : await this.buildDatasetFromKnowledge(userId);

    if (dataset.length < 2) {
      await prisma.llmTrainingJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: 'Need at least 2 training examples. Add knowledge documents.' }
      });
      throw new AppError('Need at least 2 training examples', 400);
    }

    try {
      await axios.post(
        `${llmUrl()}/train/lora`,
        {
          job_id: job.id,
          base_model: job.baseModel,
          train_type: job.trainType,
          dataset,
          config: { ...(data.config || {}), force_cpu: data.config?.force_cpu ?? !process.env.LLM_GPU_ENABLED }
        },
        { timeout: 10000 }
      );

      await prisma.llmTrainingJob.update({
        where: { id: job.id },
        data: { status: 'running', startedAt: new Date() }
      });

      this.pollJobCompletion(userId, job.id).catch(err => logger.warn('Job poll error', err));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LLM service unavailable';
      await prisma.llmTrainingJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: msg }
      });
      throw new AppError(`Training start failed: ${msg}`, 503);
    }

    return job;
  }

  private static async pollJobCompletion(userId: string, jobId: string) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const res = await axios.get(`${llmUrl()}/train/${jobId}`, { timeout: 5000 });
        const status = res.data.data.status;
        if (status === 'completed') {
          const adapterPath = res.data.data.adapter_path;
          const metrics = res.data.data.metrics;
          let s3Path: string | undefined;
          if (adapterPath) {
            s3Path = await ModelRegistryService.uploadAdapter(userId, jobId, adapterPath);
          }
          await prisma.llmTrainingJob.update({
            where: { id: jobId },
            data: {
              status: 'completed',
              completedAt: new Date(),
              adapterPath: s3Path || adapterPath,
              metrics: metrics as object
            }
          });
          await prisma.llmAdapter.create({
            data: {
              userId,
              name: `Adapter ${jobId.slice(0, 8)}`,
              baseModel: res.data.data.metrics?.base_model || 'unknown',
              adapterType: res.data.data.metrics?.train_type || 'lora',
              s3Path,
              status: 'ready',
              metrics: metrics as object
            }
          });
          return;
        }
        if (status === 'failed') {
          await prisma.llmTrainingJob.update({
            where: { id: jobId },
            data: { status: 'failed', error: res.data.data.error, completedAt: new Date() }
          });
          return;
        }
      } catch {
        /* keep polling */
      }
    }
  }

  private static async buildDatasetFromKnowledge(userId: string) {
    const docs = await prisma.knowledgeDocument.findMany({
      where: { userId },
      take: 50
    });
    return docs.map((d: { title: string; content: string; symbol: string | null }) => ({
      instruction: `Analyze or explain: ${d.title}`,
      input: d.symbol ? `Symbol: ${d.symbol}` : '',
      output: d.content.slice(0, 1000)
    }));
  }

  static async getStatus() {
    let llmHealthy = false;
    let gpu = false;
    try {
      const res = await axios.get(`${llmUrl()}/health`, { timeout: 3000 });
      llmHealthy = res.data?.status === 'ok';
      gpu = !!res.data?.gpu_available;
    } catch { /* unavailable */ }
    return { llmServiceUrl: llmUrl(), healthy: llmHealthy, gpuAvailable: gpu };
  }
}
