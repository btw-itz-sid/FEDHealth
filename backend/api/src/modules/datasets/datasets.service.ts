import { enumFilter, pagination } from '../../config/query-validation';
import { mlRequestOptions } from '../../config/security';
import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { basename, join, resolve } from 'path';
import { readFile, unlink } from 'fs/promises';
import { writeAtomically } from '../../config/persistent-files';
import { Dataset, DatasetStatus } from './entities/dataset.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class DatasetsService implements OnModuleInit {
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

  async onModuleInit() {
    if (this.configService.get('ARTIFACT_STORAGE') !== 'database') return;
    const datasets = await this.datasetRepository.createQueryBuilder('dataset').addSelect('dataset.csvBytes')
      .where('dataset.csvBytes IS NOT NULL').getMany();
    for (const dataset of datasets) {
      const filepath = join(resolve(process.env.DATASET_UPLOAD_DIR || '../../data/uploads'), `${dataset.id}.csv`);
      await writeAtomically(filepath, dataset.csvBytes!);
      await this.datasetRepository.update(dataset.id, { filepath });
      if ([DatasetStatus.PENDING, DatasetStatus.VALIDATING].includes(dataset.status)) await this.validateDatasetAsync(dataset.id);
    }
  }

  async create(
    file: Express.Multer.File,
    name: string,
    description: string,
    userId: string,
  ) {
    // Validate file type
    if (!file) throw new BadRequestException('Choose a CSV file to upload');
    if (typeof name !== 'string' || !name.trim() || name.length > 200 || typeof description !== 'string' || description.length > 2000) throw new BadRequestException('Dataset name is required (up to 200 characters); description must be at most 2000 characters');
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are accepted');
    }

    // Keep uploads small enough for the free staging server.
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    let csvBytes: Buffer | undefined;
    if (this.configService.get('ARTIFACT_STORAGE') === 'database') {
      csvBytes = await readFile(file.path);
      if (csvBytes.length > 5 * 1024 * 1024) {
        await unlink(file.path);
        throw new BadRequestException('CSV exceeds the 5 MB staging upload limit');
      }
      const [usage] = await this.datasetRepository.query('SELECT COALESCE(SUM(octet_length("csvBytes")), 0)::bigint AS bytes FROM datasets');
      if (Number(usage.bytes) + csvBytes.length > 25 * 1024 * 1024) {
        await unlink(file.path);
        throw new BadRequestException('The staging dataset storage quota is full');
      }
    }
    const dataset = this.datasetRepository.create({
      csvBytes,
      name: name.trim(),
      description: description.trim(),
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

    const { filepath, csvBytes: storedBytes, ...publicDataset } = saved;
    return publicDataset;
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
        `${this.mlServiceUrl}/api/v1/ml/datasets/validate-local?filename=${encodeURIComponent(basename(dataset.filepath))}`,
        { ...mlRequestOptions(this.configService, 60000), method: 'POST' },
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
    const { page, limit } = pagination(options);

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

    return { items: items.map(({ filepath, ...dataset }) => dataset), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const dataset = await this.datasetRepository.findOne({
      where: { id },
    });

    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }

    const { filepath, ...publicDataset } = dataset;
    return publicDataset;
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
