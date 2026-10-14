import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Prediction } from './entities/prediction.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CreatePredictionDto } from './dto/prediction.dto';
import { ModelsService } from '../models/models.service';

@Injectable()
export class PredictionsService {
  private readonly mlServiceUrl: string;

  constructor(
    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly modelsService: ModelsService,
  ) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  async create(dto: CreatePredictionDto, userId: string) {
    const modelId = dto.modelId || (await this.modelsService.getActive())?.modelId || null;

    let mlResponse: Response;
    try {
      mlResponse = await fetch(`${this.mlServiceUrl}/api/v1/ml/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Pregnancies: dto.Pregnancies,
          Glucose: dto.Glucose,
          BloodPressure: dto.BloodPressure,
          SkinThickness: dto.SkinThickness,
          Insulin: dto.Insulin,
          BMI: dto.BMI,
          DiabetesPedigreeFunction: dto.DiabetesPedigreeFunction,
          Age: dto.Age,
          model_id: modelId,
        }),
      });
    } catch {
      throw new ServiceUnavailableException('Prediction service is unavailable. Please try again later.');
    }

    if (!mlResponse.ok) {
      const error = await mlResponse.json().catch(() => ({}));
      throw new BadRequestException(
        error.detail || 'ML service prediction failed',
      );
    }

    const mlResult = await mlResponse.json();

    // Persist prediction with ownership
    const prediction = this.predictionRepository.create({
      userId,
      modelId: mlResult.model_id,
      modelVersion: mlResult.model_version,
      trainingMethod: mlResult.training_method,
      inputFeatures: {
        Pregnancies: dto.Pregnancies,
        Glucose: dto.Glucose,
        BloodPressure: dto.BloodPressure,
        SkinThickness: dto.SkinThickness,
        Insulin: dto.Insulin,
        BMI: dto.BMI,
        DiabetesPedigreeFunction: dto.DiabetesPedigreeFunction,
        Age: dto.Age,
      },
      prediction: mlResult.prediction,
      probability: mlResult.probability,
      riskLevel: mlResult.risk_level,
      disclaimer: mlResult.disclaimer,
    });

    const saved = await this.predictionRepository.save(prediction);

    await this.auditService.log({
      action: AuditAction.PREDICTION_CREATED,
      userId,
      resourceType: 'prediction',
      resourceId: saved.id,
    });

    return saved;
  }

  async findAllByUser(userId: string, options: { page?: number; limit?: number }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await this.predictionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneByUser(id: string, userId: string) {
    const prediction = await this.predictionRepository.findOne({
      where: { id, userId },  // Ownership check!
    });

    if (!prediction) {
      throw new NotFoundException('Prediction not found');
    }

    return prediction;
  }
}
