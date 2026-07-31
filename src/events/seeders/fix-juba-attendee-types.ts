import { NestFactory } from '@nestjs/core';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, InjectModel, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventSchema } from '../schemas/event.schema';
import { EventRegistration, EventRegistrationSchema, AttendeeType } from '../schemas/event-registration.schema';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: configService.get<string>('DATABASE_NAME'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
    ]),
  ],
})
class FixModule {}

async function fixJubaAttendeeTypes() {
  const logger = new Logger('FixJubaAttendeeTypes');

  const app = await NestFactory.createApplicationContext(FixModule);

  const eventModel = app.get<Model<Event>>(getModelToken(Event.name));
  const registrationModel = app.get<Model<EventRegistration>>(getModelToken(EventRegistration.name));

  try {
    const jubaEvent = await eventModel.findOne({ registrationSlug: 'juba-2026' }).lean();
    if (!jubaEvent) {
      logger.error('JÚBÀ 2026 event not found');
      await app.close();
      return;
    }

    logger.log(`Found JÚBÀ event: ${jubaEvent._id}`);

    // Find registrations where isMember custom field is "yes" but attendeeType is still "visitor"
    const toFix = await registrationModel.find({
      event: jubaEvent._id,
      attendeeType: AttendeeType.VISITOR,
      $or: [
        { 'customFieldResponses.isMember': 'yes' },
        { 'customFieldResponses.isMember': 'Yes' },
        { 'customFieldResponses.isMember': 'YES' },
      ],
    }).lean();

    logger.log(`Found ${toFix.length} registrations to fix`);

    if (toFix.length === 0) {
      logger.log('No registrations need fixing');
      await app.close();
      return;
    }

    for (const reg of toFix) {
      logger.log(`  Fixing: ${reg.attendeeInfo?.firstName} ${reg.attendeeInfo?.lastName} (${reg.attendeeInfo?.email}) — visitor → member`);
    }

    const result = await registrationModel.updateMany(
      {
        event: jubaEvent._id,
        attendeeType: AttendeeType.VISITOR,
        $or: [
          { 'customFieldResponses.isMember': 'yes' },
          { 'customFieldResponses.isMember': 'Yes' },
          { 'customFieldResponses.isMember': 'YES' },
        ],
      },
      { $set: { attendeeType: AttendeeType.MEMBER } },
    );

    logger.log(`Updated ${result.modifiedCount} registrations from VISITOR to MEMBER`);
  } catch (error) {
    logger.error(`Fix failed: ${error.message}`);
  }

  await app.close();
}

fixJubaAttendeeTypes();
