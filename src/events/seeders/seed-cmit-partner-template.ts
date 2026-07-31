import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../../bulk-email/schemas/email-template.schema';
import { CmitPartnerTemplateSeeder } from './cmit-partner-template.seeder';

@Module({
  imports: [
    AppModule,
    MongooseModule.forFeature([
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [CmitPartnerTemplateSeeder],
})
class SeederModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn'],
  });

  const seeder = app.get(CmitPartnerTemplateSeeder);

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
