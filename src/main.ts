import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { BullBoardService } from './bull-board/bull-board.service';
import { createBullBoardBasicAuthMiddleware } from './common/middleware/bull-board-auth.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Behind Nginx/other reverse proxy: trust X-Forwarded-For so req.ip is the
  // REAL client IP. Without this every request looks like the proxy's single IP,
  // so the whole cohort shares one rate-limit budget and gets throttled at once.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Capture the raw request body (used to verify Zoom webhook signatures).
  app.use(
    json({
      limit: '1mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Security
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.use(compression());

  // Enable CORS - Configure for both development and production
  const allowedOrigins = configService.get<string>('CORS_ORIGINS', '*');

  app.enableCors({
    origin: allowedOrigins === '*'
      ? true
      : allowedOrigins.split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400, // 24 hours - cache preflight requests
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation (disabled in production for security)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Church Management System API')
      .setDescription('API for Church Management System - PowerPoint Tribe')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('📚 Swagger documentation enabled at /api/docs');
  } else {
    logger.log('📚 Swagger documentation disabled in production');
  }

  // Setup Bull Board with authentication
  const bullBoardService = app.get(BullBoardService);

  // Get Bull Board credentials from environment or use defaults
  const bullBoardUsername = configService.get('BULL_BOARD_USERNAME', 'admin');
  const bullBoardPassword = configService.get('BULL_BOARD_PASSWORD', 'change-this-password');

  // Add authentication middleware
  const bullBoardAuth = createBullBoardBasicAuthMiddleware(
    bullBoardUsername,
    bullBoardPassword,
  );

  app.use('/admin/queues', bullBoardAuth, bullBoardService.getRouter());

  if (!isProduction) {
    logger.log('🎛️  Bull Board secured with Basic Auth at /admin/queues');
    logger.warn(`🔐 Bull Board credentials: ${bullBoardUsername} / ${bullBoardPassword}`);
  } else {
    logger.log('🎛️  Bull Board secured with authentication at /admin/queues');
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  logger.warn(`🚀 Church Management System API is running on port ${port}`);
  logger.warn(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

  if (!isProduction) {
    logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    logger.log(`🎛️  Bull Board Dashboard: http://localhost:${port}/admin/queues`);
  }
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Application failed to start:', err);
  process.exit(1);
});
