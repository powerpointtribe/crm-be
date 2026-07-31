import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import { Event, EventSchema } from '../schemas/event.schema';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../../bulk-email/schemas/email-template.schema';
import { CmitWelcomeTemplateSeeder } from './cmit-welcome-template.seeder';

/**
 * Standalone runner for the CMIT welcome template seeder. Re-registers the
 * Event and EmailTemplate schemas locally so the seeder's model tokens resolve
 * inside the standalone application context (see cmit-cohort-1 seeder for the
 * rationale).
 */
@Module({
  imports: [
    AppModule,
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [CmitWelcomeTemplateSeeder],
})
class SeederModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn'],
  });

  const seeder = app.get(CmitWelcomeTemplateSeeder);

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
