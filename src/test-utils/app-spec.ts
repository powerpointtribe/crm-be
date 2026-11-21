// Test-only helper. The "-spec.ts" suffix keeps it out of the production build
// (tsconfig.build.json excludes **/*spec.ts) without being picked up as a test.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Express } from 'express';

/** Same global pipe and proxy settings as main.ts (no /api/v1 prefix in tests). */
export function configureLikeMain(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
  return app;
}
