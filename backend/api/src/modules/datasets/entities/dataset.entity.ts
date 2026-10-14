import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DatasetStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  VALID = 'valid',
  INVALID = 'invalid',
}

@Entity('datasets')
export class Dataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  filename: string;

  @Column()
  filepath: string;

  @Column('int')
  fileSize: number;

  @Column('uuid')
  @Index()
  uploadedBy: string;

  @Column({
    type: 'enum',
    enum: DatasetStatus,
    default: DatasetStatus.PENDING,
  })
  status: DatasetStatus;

  @Column('jsonb', { nullable: true })
  validationResult: Record<string, any>;

  @Column('int', { nullable: true })
  numRows: number;

  @Column('int', { nullable: true })
  numColumns: number;

  @Column('jsonb', { nullable: true })
  classDistribution: Record<string, number>;

  @Column('float', { nullable: true })
  classBalance: number;

  @Column({ nullable: true })
  fingerprint: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
