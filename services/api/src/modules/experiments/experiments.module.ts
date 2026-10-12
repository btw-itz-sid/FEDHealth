import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Experiment, ExperimentRound } from './entities/experiment.entity';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Experiment, ExperimentRound]),
    AuditModule,
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
