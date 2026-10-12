import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MlModel, ModelStatus } from './entities/ml-model.entity';

@Injectable()
export class ModelsService {
  private readonly mlServiceUrl: string;

  constructor(
    @InjectRepository(MlModel)
    private readonly modelRepository: Repository<MlModel>,
    private readonly configService: ConfigService,
  ) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  async findAll(options: { page?: number; limit?: number; status?: ModelStatus }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
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

  async syncFromMlService() {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/ml/models`);
      if (!response.ok) return { synced: 0, error: 'ML service unavailable' };

      const data = await response.json();
      let synced = 0;

      for (const mlModel of data.models || []) {
        const existing = await this.modelRepository.findOne({
          where: { modelId: mlModel.model_id },
        });

        if (!existing) {
          const model = this.modelRepository.create({
            modelId: mlModel.model_id,
            modelVersion: mlModel.model_version,
            modelType: mlModel.model_type,
            trainingMethod: mlModel.training_method,
            featureColumns: mlModel.metrics?.feature_columns || [],
            metrics: mlModel.metrics,
            status: ModelStatus.READY,
          });
          await this.modelRepository.save(model);
          synced++;
        }
      }

      return { synced, total: data.total };
    } catch (error) {
      return { synced: 0, error: (error as Error).message };
    }
  }
}
