import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import { Event, EventSchema } from '../schemas/event.schema';
import {
  EventPartner,
  EventPartnerSchema,
} from '../schemas/event-partner.schema';
import { CmitPartnersSeeder } from './cmit-partners.seeder';

@Module({
  imports: [
    AppModule,
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventPartner.name, schema: EventPartnerSchema },
    ]),
  ],
  providers: [CmitPartnersSeeder],
})
class SeederModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn'],
  });

  const seeder = app.get(CmitPartnersSeeder);

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
