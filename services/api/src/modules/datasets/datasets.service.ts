import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Dataset, DatasetStatus } from './entities/dataset.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class DatasetsService {
  private readonly mlServiceUrl: string;

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  async create(
    file: Express.Multer.File,
    name: string,
    description: string,
    userId: string,
  ) {
    // Validate file type
    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are accepted');
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }

    const dataset = this.datasetRepository.create({
      name,
      description,
      filename: file.originalname,
      filepath: file.path,
      fileSize: file.size,
      uploadedBy: userId,
      status: DatasetStatus.PENDING,
    });

    const saved = await this.datasetRepository.save(dataset);

    await this.auditService.log({
      action: AuditAction.DATASET_UPLOADED,
      userId,
      resourceType: 'dataset',
      resourceId: saved.id,
      metadata: { filename: file.originalname, size: file.size },
    });

    // Trigger async validation via ML service
    this.validateDatasetAsync(saved.id).catch((err) => {
      console.error(`Dataset validation failed for ${saved.id}:`, err.message);
    });

    return saved;
  }

  private async validateDatasetAsync(datasetId: string) {
    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId },
    });
    if (!dataset) return;

    dataset.status = DatasetStatus.VALIDATING;
    await this.datasetRepository.save(dataset);

    try {
      const response = await fetch(
        `${this.mlServiceUrl}/api/v1/ml/datasets/validate-local?filename=${encodeURIComponent(dataset.filename)}`,
        { method: 'POST' },
      );

      if (!response.ok) {
        throw new Error(`ML service returned ${response.status}`);
      }

      const result = await response.json();

      dataset.status = result.is_valid
        ? DatasetStatus.VALID
        : DatasetStatus.INVALID;
      dataset.validationResult = result;
      dataset.numRows = result.stats?.num_rows || null;
      dataset.numColumns = result.stats?.num_columns || null;
      dataset.classDistribution = result.stats?.class_distribution || null;
      dataset.classBalance = result.stats?.class_balance || null;

      await this.datasetRepository.save(dataset);

      await this.auditService.log({
        action: AuditAction.DATASET_VALIDATED,
        resourceType: 'dataset',
        resourceId: datasetId,
        metadata: { status: dataset.status },
      });
    } catch (error) {
      dataset.status = DatasetStatus.INVALID;
      dataset.validationResult = {
        is_valid: false,
        errors: [`Validation failed: ${(error as Error).message}`],
      };
      await this.datasetRepository.save(dataset);
    }
  }

  async findAll(options: { page?: number; limit?: number; userId?: string }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.userId) {
      where.uploadedBy = options.userId;
    }

    const [items, total] = await this.datasetRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const dataset = await this.datasetRepository.findOne({
      where: { id },
    });

    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }

    return dataset;
  }

  async getValidation(id: string) {
    const dataset = await this.findOne(id);
    return {
      id: dataset.id,
      name: dataset.name,
      status: dataset.status,
      validationResult: dataset.validationResult,
      numRows: dataset.numRows,
      numColumns: dataset.numColumns,
      classDistribution: dataset.classDistribution,
      classBalance: dataset.classBalance,
    };
  }
}
