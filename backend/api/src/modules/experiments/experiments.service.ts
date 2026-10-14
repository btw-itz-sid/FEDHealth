import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { basename } from 'path';
import {
  Experiment,
  ExperimentRound,
  ExperimentStatus,
  TrainingMethod,
  PartitionType,
} from './entities/experiment.entity';
import { Dataset, DatasetStatus } from '../datasets/entities/dataset.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ModelsService } from '../models/models.service';
import { CreateExperimentDto } from './dto/experiment.dto';

const DP_DEFAULTS = { epsilon: 1.0, delta: 1e-5, clipNorm: 1.0 };

@Injectable()
export class ExperimentsService {
  private readonly mlServiceUrl: string;

  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentRound)
    private readonly roundRepository: Repository<ExperimentRound>,
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly modelsService: ModelsService,
  ) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  async create(dto: CreateExperimentDto, userId: string) {
    const dataset = await this.datasetRepository.findOne({ where: { id: dto.datasetId } });
    if (!dataset) {
      throw new BadRequestException('Dataset not found');
    }
    if (dataset.status !== DatasetStatus.VALID) {
      throw new BadRequestException(`Dataset is not valid (status: ${dataset.status})`);
    }

    const isCentralized = dto.trainingMethod === TrainingMethod.CENTRALIZED;
    let partitionType = dto.partitionType;
    if (isCentralized) {
      if (partitionType && partitionType !== PartitionType.NONE) {
        throw new BadRequestException('Centralized training does not use client partitioning');
      }
      partitionType = PartitionType.NONE;
    } else if (!partitionType || partitionType === PartitionType.NONE) {
      partitionType = PartitionType.IID;
    }

    if (dto.differentialPrivacy && dto.trainingMethod !== TrainingMethod.FEDAVG) {
      throw new BadRequestException('Differential privacy is only supported for FedAvg');
    }

    const dpConfig = dto.differentialPrivacy ? { ...DP_DEFAULTS, ...dto.dpConfig } : undefined;

    const experiment = this.experimentRepository.create({
      ...dto,
      partitionType,
      dpConfig,
      createdBy: userId,
      status: ExperimentStatus.QUEUED,
      configSnapshot: { ...dto, partitionType, dpConfig },
    });

    const saved = await this.experimentRepository.save(experiment);

    await this.auditService.log({
      action: AuditAction.EXPERIMENT_CREATED,
      userId,
      resourceType: 'experiment',
      resourceId: saved.id,
      metadata: { trainingMethod: dto.trainingMethod, partitionType },
    });

    this.runExperimentAsync(saved.id, basename(dataset.filepath)).catch((err) => {
      console.error(`Experiment ${saved.id} failed:`, err.message);
    });

    return saved;
  }

  private buildTrainingRequest(experiment: Experiment, datasetFile: string) {
    const common = {
      dataset_path: datasetFile,
      random_seed: experiment.randomSeed,
      test_size: experiment.testSize,
      experiment_id: experiment.id,
      experiment_name: experiment.name,
    };

    if (experiment.trainingMethod === TrainingMethod.CENTRALIZED) {
      return { endpoint: '/api/v1/ml/train/centralized', body: common };
    }

    const dp = experiment.dpConfig || DP_DEFAULTS;
    return {
      endpoint: '/api/v1/ml/train/federated',
      body: {
        ...common,
        training_method: experiment.trainingMethod,
        partition_type: experiment.partitionType,
        num_clients: experiment.numClients,
        num_rounds: experiment.numRounds,
        local_epochs: experiment.localEpochs,
        learning_rate: experiment.learningRate,
        batch_size: experiment.batchSize,
        dp_enabled: experiment.differentialPrivacy,
        dp_epsilon: dp.epsilon,
        dp_delta: dp.delta,
        dp_clip_norm: dp.clipNorm,
      },
    };
  }

  private async runExperimentAsync(experimentId: string, datasetFile: string) {
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
    });
    if (!experiment) return;

    experiment.status = ExperimentStatus.RUNNING;
    experiment.startedAt = new Date();
    await this.experimentRepository.save(experiment);

    await this.auditService.log({
      action: AuditAction.EXPERIMENT_STARTED,
      resourceType: 'experiment',
      resourceId: experimentId,
    });

    try {
      const { endpoint, body } = this.buildTrainingRequest(experiment, datasetFile);
      const response = await fetch(`${this.mlServiceUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
        throw new Error(detail || `ML service returned ${response.status}`);
      }

      const result = await response.json();

      const current = await this.experimentRepository.findOne({ where: { id: experimentId } });
      if (current?.status === ExperimentStatus.CANCELLED) return;

      const rounds = result.rounds
        ? result.rounds.map((r: any) =>
            this.roundRepository.create({
              experimentId,
              roundNumber: r.round_number,
              trainMetrics: r.train_metrics,
              evalMetrics: r.eval_metrics,
              clientMetrics: r.client_metrics,
              participatingClients: r.participating_clients,
              durationSeconds: r.duration_seconds,
              communicationBytes: r.communication_bytes,
            }),
          )
        : [
            this.roundRepository.create({
              experimentId,
              roundNumber: 1,
              trainMetrics: {
                accuracy: result.metrics.train_accuracy,
                roc_auc: result.metrics.train_roc_auc,
              },
              evalMetrics: result.metrics,
              durationSeconds: result.metrics.training_duration_seconds,
            }),
          ];
      await this.roundRepository.save(rounds);

      if (result.model_id) {
        await this.modelsService.register({
          modelId: result.model_id,
          modelVersion: result.model_version,
          modelType: result.model_type,
          trainingMethod: result.training_config?.dp_enabled ? 'fedavg_dp' : result.training_method,
          datasetId: experiment.datasetId,
          experimentId,
          featureColumns: result.feature_columns,
          trainingConfig: result.training_config,
          metrics: result.metrics,
          datasetFingerprint: result.dataset_fingerprint,
        });
      }

      experiment.status = ExperimentStatus.COMPLETED;
      experiment.completedAt = new Date();
      experiment.currentRound = rounds.length;
      experiment.modelId = result.model_id;
      experiment.finalMetrics = { ...result.metrics, clients: result.clients };
      experiment.durationSeconds =
        (experiment.completedAt.getTime() - experiment.startedAt.getTime()) / 1000;
      await this.experimentRepository.save(experiment);

      await this.auditService.log({
        action: AuditAction.EXPERIMENT_COMPLETED,
        resourceType: 'experiment',
        resourceId: experimentId,
        metadata: { modelId: result.model_id },
      });
    } catch (error) {
      const message =
        (error as Error).message === 'fetch failed'
          ? 'ML service is unreachable'
          : (error as Error).message;
      experiment.status = ExperimentStatus.FAILED;
      experiment.errorMessage = message;
      experiment.completedAt = new Date();
      await this.experimentRepository.save(experiment);

      await this.auditService.log({
        action: AuditAction.EXPERIMENT_FAILED,
        resourceType: 'experiment',
        resourceId: experimentId,
        metadata: { error: message },
      });
    }
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: ExperimentStatus;
    trainingMethod?: TrainingMethod;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const queryBuilder = this.experimentRepository
      .createQueryBuilder('exp')
      .orderBy('exp.createdAt', 'DESC');

    if (options.status) {
      queryBuilder.andWhere('exp.status = :status', { status: options.status });
    }
    if (options.trainingMethod) {
      queryBuilder.andWhere('exp.trainingMethod = :method', {
        method: options.trainingMethod,
      });
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const experiment = await this.experimentRepository.findOne({
      where: { id },
    });
    if (!experiment) throw new NotFoundException('Experiment not found');
    return experiment;
  }

  async getMetrics(id: string) {
    const experiment = await this.findOne(id);
    return {
      experimentId: id,
      status: experiment.status,
      finalMetrics: experiment.finalMetrics,
      modelId: experiment.modelId,
      durationSeconds: experiment.durationSeconds,
    };
  }

  async getRounds(id: string) {
    await this.findOne(id);
    const rounds = await this.roundRepository.find({
      where: { experimentId: id },
      order: { roundNumber: 'ASC' },
    });
    return { experimentId: id, rounds };
  }

  async cancel(id: string, userId: string) {
    const experiment = await this.findOne(id);
    if (
      experiment.status !== ExperimentStatus.QUEUED &&
      experiment.status !== ExperimentStatus.RUNNING
    ) {
      throw new BadRequestException(
        `Cannot cancel experiment with status '${experiment.status}'`,
      );
    }

    experiment.status = ExperimentStatus.CANCELLED;
    experiment.completedAt = new Date();
    await this.experimentRepository.save(experiment);

    await this.auditService.log({
      action: AuditAction.EXPERIMENT_CANCELLED,
      userId,
      resourceType: 'experiment',
      resourceId: id,
    });

    return experiment;
  }
}
