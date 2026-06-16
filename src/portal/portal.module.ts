import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { PortalJwtStrategy } from './strategies/portal-jwt.strategy';
import {
  PortalAccount,
  PortalAccountSchema,
} from './schemas/portal-account.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from '../events/schemas/event-registration.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { QueueName } from '../common/interfaces/queue-job.interface';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([
      { name: PortalAccount.name, schema: PortalAccountSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: Event.name, schema: EventSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('PORTAL_JWT_EXPIRATION', '30d'),
        },
      }),
    }),
    BullModule.registerQueue({ name: QueueName.EMAIL_NOTIFICATIONS }),
  ],
  controllers: [PortalController],
  providers: [PortalService, PortalJwtStrategy],
  exports: [PortalService],
})
export class PortalModule {}
