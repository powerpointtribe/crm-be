import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      message: 'Welcome to Church Management System API',
      version: '1.0.0',
      documentation: '/api/docs',
      status: 'active',
      timestamp: new Date().toISOString(),
    };
  }

  getHealth(): object {
    return {
      status: 'OK',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
    };
  }
}
