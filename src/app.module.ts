import 'dotenv/config'; // load .env into process.env before the @Module decorator evaluates (so CRONS_ENABLED is readable here)
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
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
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { InventoryModule } from './inventory/inventory.module';
import { WorkersTrainingModule } from './workers-training/workers-training.module';
import { ActivityTrackerModule } from './activity-tracker/activity-tracker.module';
import { UserInvitationsModule } from './user-invitations/user-invitations.module';
import { FinanceModule } from './finance/finance.module';
import { EntryImportModule } from './entry-import/entry-import.module';
import { EventsModule } from './events/events.module';
import { LibraryModule } from './library/library.module';
import { BulkEmailModule } from './bulk-email/bulk-email.module';
import { PortalModule } from './portal/portal.module';
import { LmsModule } from './lms/lms.module';

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
        // Bound the connection pool so a single instance can't exhaust the
        // cluster's connection limit, and fail fast instead of hanging when
        // the cluster is slow/unreachable (prevents 15s+ "no-response" hangs).
        maxPoolSize: Number(configService.get('MONGO_MAX_POOL_SIZE') ?? 20),
        minPoolSize: 2,
        maxIdleTimeMS: 60_000, // reclaim idle sockets after 60s
        serverSelectionTimeoutMS: 8_000, // give up finding a server in 8s
        socketTimeoutMS: 45_000, // abort a stuck operation after 45s
        waitQueueTimeoutMS: 10_000, // don't wait forever for a pooled connection
      }),
    }),

    // Scheduling — global kill-switch. Set CRONS_ENABLED=false to disable ALL
    // cron jobs (e.g. when running a local backend against the prod DB, so it
    // can't fire real reminder/notification emails or duplicate scheduled work
    // the deployed prod backend already runs). Without ScheduleModule the
    // @Cron() handlers are never wired up.
    ...(process.env.CRONS_ENABLED === 'false'
      ? []
      : [ScheduleModule.forRoot()]),

    // Rate limiting — per client IP (see `trust proxy` in main.ts). 300/min
    // gives headroom for legitimate bursts (portal page loads fan out to several
    // authenticated calls); the hot live-session endpoints skip throttling.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 300,
      },
    ]),

    // Feature modules
    AuthModule,
    RolesModule,
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
    AuditLogsModule,
    InventoryModule,
    WorkersTrainingModule,
    ActivityTrackerModule,
    UserInvitationsModule,
    FinanceModule,
    EntryImportModule,
    EventsModule,
    LibraryModule,
    BulkEmailModule,
    PortalModule,
    LmsModule,
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
