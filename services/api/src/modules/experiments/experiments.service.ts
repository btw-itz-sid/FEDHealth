import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Experiment,
  ExperimentRound,
  ExperimentStatus,
  TrainingMethod,
  PartitionType,
} from './entities/experiment.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CreateExperimentDto } from './dto/experiment.dto';

@Injectable()
export class ExperimentsService {
  private readonly mlServiceUrl: string;

  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentRound)
    private readonly roundRepository: Repository<ExperimentRound>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  async create(dto: CreateExperimentDto, userId: string) {
    // Validate training method + partition type combo
    if (
      dto.trainingMethod === TrainingMethod.CENTRALIZED &&
      dto.partitionType !== PartitionType.NONE
    ) {
      throw new BadRequestException(
        'Centralized training does not use client partitioning',
      );
    }

    const experiment = this.experimentRepository.create({
      ...dto,
      createdBy: userId,
      status: ExperimentStatus.QUEUED,
      configSnapshot: { ...dto },
    });

    const saved = await this.experimentRepository.save(experiment);

    await this.auditService.log({
      action: AuditAction.EXPERIMENT_CREATED,
      userId,
      resourceType: 'experiment',
      resourceId: saved.id,
      metadata: { trainingMethod: dto.trainingMethod },
    });

    // Launch experiment asynchronously
    this.runExperimentAsync(saved.id).catch((err) => {
      console.error(`Experiment ${saved.id} failed:`, err.message);
    });

    return saved;
  }

  private async runExperimentAsync(experimentId: string) {
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
      let endpoint = '';
      if (experiment.trainingMethod === TrainingMethod.CENTRALIZED) {
        endpoint = '/api/v1/ml/train/centralized';
      } else {
        // For federated/local_only, will be implemented in Phase 6
        throw new Error(
          `Training method '${experiment.trainingMethod}' not yet implemented`,
        );
      }

      const response = await fetch(`${this.mlServiceUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          random_seed: experiment.randomSeed,
          test_size: experiment.testSize,
          experiment_id: experiment.id,
          experiment_name: experiment.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `ML service returned ${response.status}`);
      }

      const result = await response.json();

      // Save round data for centralized (single round)
      const round = this.roundRepository.create({
        experimentId: experiment.id,
        roundNumber: 1,
        trainMetrics: {
          accuracy: result.metrics.train_accuracy,
          roc_auc: result.metrics.train_roc_auc,
        },
        evalMetrics: result.metrics,
        durationSeconds: result.metrics.training_duration_seconds,
      });
      await this.roundRepository.save(round);

      // Update experiment
      experiment.status = ExperimentStatus.COMPLETED;
      experiment.completedAt = new Date();
      experiment.currentRound = 1;
      experiment.modelId = result.model_id;
      experiment.finalMetrics = result.metrics;
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
      experiment.status = ExperimentStatus.FAILED;
      experiment.errorMessage = (error as Error).message;
      experiment.completedAt = new Date();
      await this.experimentRepository.save(experiment);

      await this.auditService.log({
        action: AuditAction.EXPERIMENT_FAILED,
        resourceType: 'experiment',
        resourceId: experimentId,
        metadata: { error: (error as Error).message },
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
