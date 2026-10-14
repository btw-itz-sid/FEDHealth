import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Experiment, ExperimentRound } from './entities/experiment.entity';
import { Dataset } from '../datasets/entities/dataset.entity';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';
import { AuditModule } from '../audit/audit.module';
import { ModelsModule } from '../models/models.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Experiment, ExperimentRound, Dataset]),
    AuditModule,
    ModelsModule,
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
