import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum ExperimentStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TrainingMethod {
  CENTRALIZED = 'centralized',
  LOCAL_ONLY = 'local_only',
  FEDAVG = 'fedavg',
}

export enum PartitionType {
  IID = 'iid',
  NON_IID = 'non_iid',
  NONE = 'none',
}

@Entity('experiments')
export class Experiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  notes: string;

  @Column('uuid')
  @Index()
  createdBy: string;

  @Column('uuid')
  datasetId: string;

  @Column({
    type: 'enum',
    enum: TrainingMethod,
    default: TrainingMethod.CENTRALIZED,
  })
  trainingMethod: TrainingMethod;

  @Column('int', { default: 5 })
  numClients: number;

  @Column({
    type: 'enum',
    enum: PartitionType,
    default: PartitionType.NONE,
  })
  partitionType: PartitionType;

  @Column('int', { default: 10 })
  numRounds: number;

  @Column('int', { default: 5 })
  localEpochs: number;

  @Column('float', { default: 0.01 })
  learningRate: number;

  @Column('int', { default: 32 })
  batchSize: number;

  @Column('int', { default: 42 })
  randomSeed: number;

  @Column('float', { default: 0.2 })
  testSize: number;

  @Column({ default: false })
  differentialPrivacy: boolean;

  @Column('jsonb', { nullable: true })
  dpConfig: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ExperimentStatus,
    default: ExperimentStatus.QUEUED,
  })
  @Index()
  status: ExperimentStatus;

  @Column('int', { nullable: true })
  currentRound: number;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  modelId: string;

  @Column('jsonb', { nullable: true })
  configSnapshot: Record<string, any>;

  @Column('jsonb', { nullable: true })
  finalMetrics: Record<string, any>;

  @Column('float', { nullable: true })
  durationSeconds: number;

  @OneToMany(() => ExperimentRound, (round) => round.experiment)
  rounds: ExperimentRound[];

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('experiment_rounds')
export class ExperimentRound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  experimentId: string;

  @ManyToOne(() => Experiment, (exp) => exp.rounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'experimentId' })
  experiment: Experiment;

  @Column('int')
  roundNumber: number;

  @Column('jsonb', { nullable: true })
  trainMetrics: Record<string, any>;

  @Column('jsonb', { nullable: true })
  evalMetrics: Record<string, any>;

  @Column('jsonb', { nullable: true })
  clientMetrics: Record<string, any>[];

  @Column('int', { nullable: true })
  participatingClients: number;

  @Column('float', { nullable: true })
  durationSeconds: number;

  @Column('float', { nullable: true })
  communicationBytes: number;

  @CreateDateColumn()
  createdAt: Date;
}

