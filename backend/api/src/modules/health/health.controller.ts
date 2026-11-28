import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly database: DataSource, private readonly config: ConfigService) {}

  @Get('/health/ready')
  async ready() {
    try {
      await this.database.query('SELECT 1');
      const response = await fetch(`${this.config.get('ML_SERVICE_URL', 'http://127.0.0.1:8000')}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error('ML unavailable');
      return { status: 'ready' };
    } catch { throw new ServiceUnavailableException('Service is starting or temporarily unavailable'); }
  }

  @Get('/health')
  @ApiOperation({ summary: 'API health check' })
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'fedhealth-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
