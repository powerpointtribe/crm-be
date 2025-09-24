import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health Check')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Welcome endpoint',
    description: 'Returns welcome message and API information',
  })
  @ApiResponse({
    status: 200,
    description: 'Welcome message returned successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Welcome to Church Management System API',
        },
        version: { type: 'string', example: '1.0.0' },
        documentation: { type: 'string', example: '/api/docs' },
        status: { type: 'string', example: 'active' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  getHello(): object {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns application health status and system information',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status returned successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        uptime: { type: 'number', example: 123.456 },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'number' },
            heapTotal: { type: 'number' },
            heapUsed: { type: 'number' },
            external: { type: 'number' },
          },
        },
      },
    },
  })
  getHealth(): object {
    return this.appService.getHealth();
  }
}
