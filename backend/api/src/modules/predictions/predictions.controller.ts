import { Controller, Post, Get, Param, Body, Query, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PredictionsService } from './predictions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePredictionDto } from './dto/prediction.dto';
import { Request } from 'express';

@ApiTags('Predictions')
@Controller('predictions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a diabetes risk assessment' })
  async create(@Body() dto: CreatePredictionDto, @Req() req: Request) {
    return this.predictionsService.create(dto, (req.user as any).id);
  }

  @Get()
  @ApiOperation({ summary: 'Get own prediction history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.predictionsService.findAllByUser((req.user as any).id, { page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific prediction (own only)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.predictionsService.findOneByUser(id, (req.user as any).id);
  }
}
