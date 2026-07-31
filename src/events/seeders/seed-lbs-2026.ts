import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { LBS2026EventSeeder } from './lbs-2026-event.seeder';

@Module({
  imports: [AppModule],
  providers: [LBS2026EventSeeder],
})
class SeederModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn'],
  });

  const seeder = app.get(LBS2026EventSeeder);

  const command = process.argv[2];

  try {
    if (command === 'remove' || command === '--remove' || command === '-r') {
      await seeder.remove();
    } else {
      await seeder.seed();
    }

    console.log('✅ Seeder operation completed successfully');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeder operation failed:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
