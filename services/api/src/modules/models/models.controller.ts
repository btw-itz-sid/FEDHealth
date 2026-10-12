import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ModelsService } from './models.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { ModelStatus } from './entities/ml-model.entity';

@ApiTags('Models')
@Controller('models')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List trained models' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ModelStatus })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: ModelStatus,
  ) {
    return this.modelsService.findAll({ page, limit, status });
  }

  @Get(':id')
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get model details' })
  async findOne(@Param('id') id: string) {
    return this.modelsService.findOne(id);
  }

  @Post('sync')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Sync models from ML service (admin only)' })
  async sync() {
    return this.modelsService.syncFromMlService();
  }
}
