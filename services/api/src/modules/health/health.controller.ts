import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
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
