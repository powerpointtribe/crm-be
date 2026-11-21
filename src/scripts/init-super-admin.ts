import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

/**
 * `npm run seed:admin` — idempotent bootstrap of permissions, system roles,
 * the default campus and the super admin (SUPER_ADMIN_EMAIL /
 * SUPER_ADMIN_PASSWORD from the environment).
 *
 * It runs the exact path the server runs on startup (AutoInitService), but in
 * the foreground. The background copy is switched off first: otherwise it
 * races this script on a fresh database and is still writing when the app
 * context closes.
 */
async function initializeSuperAdmin() {
  const logger = new Logger('InitSuperAdmin');
  logger.log('Starting super admin initialization...');

  // Must be set before AppModule is loaded so ConfigService sees it
  // (dotenv never overrides a variable that is already set).
  process.env.AUTO_INIT_SUPER_ADMIN = 'false';
  const { AppModule } = await import('../app.module');
  const { AutoInitService } = await import('../roles/services/auto-init.service');

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get(AutoInitService).initializeIfNeeded();
  } finally {
    await app.close();
  }
}

initializeSuperAdmin()
  .then(() => {
    console.log('✓ Super admin initialization completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Super admin initialization failed:', error);
    process.exit(1);
  });
