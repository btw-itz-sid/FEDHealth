import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MlModel } from './entities/ml-model.entity';
import { ModelsService } from './models.service';
import { ModelsController } from './models.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MlModel])],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
