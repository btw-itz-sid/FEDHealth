import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('predictions')
export class Prediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.predictions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  modelId: string;

  @Column()
  modelVersion: string;

  @Column({ nullable: true })
  trainingMethod: string;

  @Column('jsonb')
  inputFeatures: Record<string, number>;

  @Column('int')
  prediction: number;

  @Column('float')
  probability: number;

  @Column()
  riskLevel: string;

  @Column({ type: 'text' })
  disclaimer: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
