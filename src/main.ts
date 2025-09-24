import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Security - but allow Swagger UI resources
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow Swagger UI to load
    }),
  );
  app.use(compression());

  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation - IMPROVED CONFIGURATION
  const config = new DocumentBuilder()
    .setTitle('Church Management System API')
    .setDescription(
      `
      Complete Church Management System API for PowerPoint Tribe
      
      ## Features
      - 🔐 JWT Authentication & Authorization
      - 👥 User Management with Role-based Access
      - 📊 Comprehensive API Documentation
      - 🛡️ Input Validation & Security
      
      ## Authentication
      1. Register a new user via /auth/register
      2. Login via /auth/login to get JWT token
      3. Use the token in Authorization header: Bearer <your-token>
      
      ## User Roles
      - **super_admin**: Full system access
      - **pastor**: Leadership access
      - **leadership**: Management access  
      - **follow_up_team**: First-timers management
      - **group_leader**: Group management
      - **member**: Basic access
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    })
    .addTag('Health Check', 'Application health and status endpoints')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management operations')
    .addServer('http://localhost:3000', 'Development server')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Church Management System API',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(
    `🚀 Church Management System API is running on: http://localhost:${port}`,
  );
  console.log(
    `📚 API Documentation available at: http://localhost:${port}/api/docs`,
  );
  console.log(`🔗 Health Check: http://localhost:${port}/api/v1/`);
  console.log(`🔗 API Base URL: http://localhost:${port}/api/v1/`);
}

bootstrap();
