import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { GroupsModule } from './groups/groups.module';
import { FirstTimersModule } from './first-timers/first-timers.module';
import { ServiceReportsModule } from './service-reports/service-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QueueModule } from './queue/queue.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BullBoardModule } from './bull-board/bull-board.module';
import { BulkOperationsModule } from './bulk-operations/bulk-operations.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: configService.get<string>('DATABASE_NAME'),
        ssl: true,
        tls: true,
        tlsInsecure: false,
      }),
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Feature modules
    AuthModule,
    MembersModule,
    GroupsModule,
    FirstTimersModule,
    ServiceReportsModule,
    NotificationsModule,
    QueueModule,
    DashboardModule,
    BullBoardModule,
    BulkOperationsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
