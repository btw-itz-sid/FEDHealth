import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatasetsService } from './datasets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { Request } from 'express';

function datasetUploadDir(): string {
  return process.env.DATASET_UPLOAD_DIR || resolve(process.cwd(), '../../data/uploads');
}

@ApiTags('Datasets')
@Controller('datasets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Post()
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        // Shared with the ML service, which resolves datasets from data/uploads
        destination: (_req, _file, cb) => {
          const dir = datasetUploadDir();
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          // Sanitize: use UUID, never trust original filename for storage
          const safeName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, safeName);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.csv$/i)) {
          return cb(new Error('Only CSV files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a research dataset (researcher only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('description') description: string,
    @Req() req: Request,
  ) {
    return this.datasetsService.create(
      file,
      name || file.originalname,
      description || '',
      (req.user as any).id,
    );
  }

  @Get()
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List datasets' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.datasetsService.findAll({ page, limit });
  }

  @Get(':id')
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get dataset details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasetsService.findOne(id);
  }

  @Get(':id/validation')
  @Roles(UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get dataset validation results' })
  async getValidation(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasetsService.getValidation(id);
  }
}
