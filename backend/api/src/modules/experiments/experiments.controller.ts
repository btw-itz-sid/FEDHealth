import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ExperimentsService } from './experiments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateExperimentDto } from './dto/experiment.dto';
import { ExperimentStatus, TrainingMethod } from './entities/experiment.entity';
import { Request } from 'express';

@ApiTags('Experiments')
@Controller('experiments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post()
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create and start an experiment' })
  async create(@Body() dto: CreateExperimentDto, @Req() req: Request) {
    return this.experimentsService.create(dto, (req.user as any).id);
  }

  @Get()
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List experiments' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ExperimentStatus })
  @ApiQuery({ name: 'trainingMethod', required: false, enum: TrainingMethod })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: ExperimentStatus,
    @Query('trainingMethod') trainingMethod?: TrainingMethod,
  ) {
    return this.experimentsService.findAll({ page, limit, status, trainingMethod });
  }

  @Get(':id')
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get experiment details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.experimentsService.findOne(id);
  }

  @Get(':id/metrics')
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get experiment metrics' })
  async getMetrics(@Param('id', ParseUUIDPipe) id: string) {
    return this.experimentsService.getMetrics(id);
  }

  @Get(':id/rounds')
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get per-round metrics' })
  async getRounds(@Param('id', ParseUUIDPipe) id: string) {
    return this.experimentsService.getRounds(id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel a running experiment' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.experimentsService.cancel(id, (req.user as any).id);
  }
}
