import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import { Event, EventSchema } from '../schemas/event.schema';
import { CmitCohort1EventSeeder } from './cmit-cohort-1-event.seeder';

/**
 * NB: We re-register the Event schema directly in this SeederModule rather
 * than relying on AppModule's re-export. The standalone application context
 * created by NestFactory.createApplicationContext does not always propagate
 * dynamic providers (like `getModelToken(Event.name)`) up to a child module,
 * which causes "Nest can't resolve dependencies … EventModel" at runtime.
 * Re-registering here keeps the seeder self-contained.
 */
@Module({
  imports: [
    AppModule,
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
  ],
  providers: [CmitCohort1EventSeeder],
})
class SeederModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn'],
  });

  const seeder = app.get(CmitCohort1EventSeeder);

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
