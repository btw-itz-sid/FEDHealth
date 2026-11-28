import { join } from 'path';
import { modelDirectory, readModelArtifacts, writeAtomically } from '../../config/persistent-files';
import { OnModuleInit } from '@nestjs/common';
import { enumFilter, pagination } from '../../config/query-validation';
import { mlRequestOptions } from '../../config/security';
import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MlModel, ModelStatus } from './entities/ml-model.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

export interface RegisterModelInput {
  modelId: string;
  modelVersion: string;
  modelType: string;
  trainingMethod: string;
  datasetId?: string;
  experimentId?: string;
  featureColumns?: string[];
  trainingConfig?: Record<string, any>;
  metrics?: Record<string, any>;
  datasetFingerprint?: string;
}

@Injectable()
export class ModelsService implements OnModuleInit {
  private readonly mlServiceUrl: string;

  constructor(
    @InjectRepository(MlModel)
    private readonly modelRepository: Repository<MlModel>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  async onModuleInit() {
    if (this.configService.get('ARTIFACT_STORAGE') !== 'database') return;
    const models = await this.modelRepository.createQueryBuilder('model')
      .addSelect(['model.artifactBytes', 'model.artifactMetadata'])
      .where('model.artifactBytes IS NOT NULL').getMany();
    for (const model of models) {
      const directory = modelDirectory(model.modelId);
      await writeAtomically(join(directory, 'pipeline.joblib'), model.artifactBytes!);
      await writeAtomically(join(directory, 'metadata.json'), JSON.stringify(model.artifactMetadata));
    }
  }

  async findAll(options: { page?: number; limit?: number; status?: ModelStatus }) {
    const { page, limit } = pagination(options);
    enumFilter(options.status, ModelStatus, 'status');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.status) where.status = options.status;

    const [items, total] = await this.modelRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const model = await this.modelRepository.findOne({ where: { id } });
    if (!model) throw new NotFoundException('Model not found');
    return model;
  }

  async register(input: RegisterModelInput) {
    const existing = await this.modelRepository.findOne({
      where: { modelId: input.modelId },
    });
    if (existing) return existing;

    let artifacts: { artifactBytes?: Buffer; artifactMetadata?: Record<string, any> } = {};
    if (this.configService.get('ARTIFACT_STORAGE') === 'database') {
      const { bytes, metadata } = await readModelArtifacts(input.modelId);
      const [usage] = await this.modelRepository.query('SELECT COALESCE(SUM(octet_length("artifactBytes")), 0)::bigint AS bytes FROM ml_models');
      if (Number(usage.bytes) + bytes.length > 100 * 1024 * 1024) throw new BadRequestException('The staging model storage quota is full. Export models and ask the operator to free storage.');
      artifacts = { artifactBytes: bytes, artifactMetadata: metadata };
    }
    const model = await this.modelRepository.save(
      this.modelRepository.create({
        ...input,
        ...artifacts,
        featureColumns: input.featureColumns || [],
        status: ModelStatus.READY,
        isActive: false,
      }),
    );

    // The first model ever trained serves predictions until one is chosen.
    // The partial unique index makes concurrent registrations race safely.
    if (!(await this.modelRepository.exists({ where: { isActive: true } }))) {
      try {
        await this.modelRepository.update({ id: model.id }, { isActive: true });
        model.isActive = true;
      } catch {
        // Another model became active first
      }
    }

    await this.auditService.log({
      action: AuditAction.MODEL_CREATED,
      resourceType: 'model',
      resourceId: model.id,
      metadata: { modelId: model.modelId, trainingMethod: model.trainingMethod },
    });

    const { artifactBytes, artifactMetadata, ...publicModel } = model;
    return publicModel;
  }

  async activate(id: string, userId: string) {
    const model = await this.findOne(id);
    if (model.status !== ModelStatus.READY) {
      throw new BadRequestException(`Cannot activate a model with status '${model.status}'`);
    }

    // Database history can outlive the ML filesystem (for example after a move
    // or redeployment). Verify the actual artifacts before changing the active model.
    let available: { models: { model_id: string }[] };
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/ml/models`, {
        ...mlRequestOptions(this.configService, 5000),
      });
      if (!response.ok) throw new Error('Model listing failed');
      available = await response.json();
      if (!Array.isArray(available.models)) throw new Error('Invalid model listing');
    } catch {
      throw new ServiceUnavailableException('Cannot verify model files. Check that the ML service is running.');
    }
    if (!available.models.some((candidate) => candidate.model_id === model.modelId)) {
      throw new BadRequestException('Model files are missing on the ML service. Train a new experiment before activating this model.');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(MlModel, { isActive: true }, { isActive: false });
      await manager.update(MlModel, { id }, { isActive: true });
    });

    await this.auditService.log({
      action: AuditAction.ADMIN_ACTION,
      userId,
      resourceType: 'model',
      resourceId: id,
      metadata: { event: 'model_activated', modelId: model.modelId },
    });

    return { ...model, isActive: true };
  }

  async getActive() {
    return this.modelRepository.findOne({ where: { isActive: true } });
  }

  async syncFromMlService() {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/ml/models`, mlRequestOptions(this.configService, 5000));
      if (!response.ok) return { synced: 0, error: 'ML service unavailable' };

      const data = await response.json();
      let synced = 0;

      for (const mlModel of data.models || []) {
        const existing = await this.modelRepository.findOne({
          where: { modelId: mlModel.model_id },
        });

        if (!existing) {
          await this.register({
            modelId: mlModel.model_id,
            modelVersion: mlModel.model_version,
            modelType: mlModel.model_type,
            trainingMethod: mlModel.training_method,
            metrics: mlModel.metrics,
          });
          synced++;
        }
      }

      return { synced, total: data.total };
    } catch (error) {
      return { synced: 0, error: (error as Error).message };
    }
  }
}
