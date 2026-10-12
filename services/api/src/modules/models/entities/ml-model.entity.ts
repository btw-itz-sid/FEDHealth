import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ModelStatus {
  TRAINING = 'training',
  READY = 'ready',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

@Entity('ml_models')
export class MlModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  modelId: string;  // ML service model identifier

  @Column()
  @Index()
  modelVersion: string;

  @Column()
  modelType: string;

  @Column()
  trainingMethod: string;

  @Column('uuid', { nullable: true })
  datasetId: string;

  @Column('uuid', { nullable: true })
  experimentId: string;

  @Column('jsonb')
  featureColumns: string[];

  @Column('jsonb', { nullable: true })
  preprocessingConfig: Record<string, any>;

  @Column('jsonb', { nullable: true })
  trainingConfig: Record<string, any>;

  @Column('jsonb', { nullable: true })
  metrics: Record<string, any>;

  @Column({ nullable: true })
  artifactPath: string;

  @Column({ nullable: true })
  datasetFingerprint: string;

  @Column({
    type: 'enum',
    enum: ModelStatus,
    default: ModelStatus.TRAINING,
  })
  @Index()
  status: ModelStatus;

  @CreateDateColumn()
  createdAt: Date;
}
