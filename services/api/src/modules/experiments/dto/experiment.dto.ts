import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  IsUUID,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingMethod, PartitionType } from '../entities/experiment.entity';

export class CreateExperimentDto {
  @ApiProperty({ example: 'Centralized Baseline v1' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty()
  @IsUUID()
  datasetId: string;

  @ApiProperty({ enum: TrainingMethod, example: TrainingMethod.CENTRALIZED })
  @IsEnum(TrainingMethod)
  trainingMethod: TrainingMethod;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(2) @Max(20)
  numClients?: number;

  @ApiPropertyOptional({ enum: PartitionType, default: PartitionType.NONE })
  @IsOptional()
  @IsEnum(PartitionType)
  partitionType?: PartitionType;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1) @Max(100)
  numRounds?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1) @Max(50)
  localEpochs?: number;

  @ApiPropertyOptional({ default: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.0001) @Max(1)
  learningRate?: number;

  @ApiPropertyOptional({ default: 32 })
  @IsOptional()
  @IsInt()
  @Min(8) @Max(256)
  batchSize?: number;

  @ApiPropertyOptional({ default: 42 })
  @IsOptional()
  @IsInt()
  @Min(0) @Max(999999)
  randomSeed?: number;

  @ApiPropertyOptional({ default: 0.2 })
  @IsOptional()
  @IsNumber()
  @Min(0.05) @Max(0.5)
  testSize?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  differentialPrivacy?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dpConfig?: Record<string, any>;
}
