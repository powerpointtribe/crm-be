import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Event, EventSchema } from '../schemas/event.schema';
import { Juba2026EventSeeder } from './juba-2026-event.seeder';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: configService.get<string>('DATABASE_NAME'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
  ],
  providers: [Juba2026EventSeeder],
})
class SeederModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn', 'log'],
  });

  const seeder = app.get(Juba2026EventSeeder);

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
