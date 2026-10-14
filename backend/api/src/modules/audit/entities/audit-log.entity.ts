import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGIN_FAILED = 'user_login_failed',
  USER_LOGOUT = 'user_logout',
  USER_ROLE_CHANGED = 'user_role_changed',
  USER_DEACTIVATED = 'user_deactivated',
  PREDICTION_CREATED = 'prediction_created',
  DATASET_UPLOADED = 'dataset_uploaded',
  DATASET_VALIDATED = 'dataset_validated',
  EXPERIMENT_CREATED = 'experiment_created',
  EXPERIMENT_STARTED = 'experiment_started',
  EXPERIMENT_COMPLETED = 'experiment_completed',
  EXPERIMENT_FAILED = 'experiment_failed',
  EXPERIMENT_CANCELLED = 'experiment_cancelled',
  MODEL_CREATED = 'model_created',
  ADMIN_ACTION = 'admin_action',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  @Index()
  action: AuditAction;

  @Column('uuid', { nullable: true })
  @Index()
  userId: string;

  @Column({ nullable: true })
  userEmail: string;

  @Column({ nullable: true })
  resourceType: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
