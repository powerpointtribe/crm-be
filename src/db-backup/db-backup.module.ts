import { Module } from '@nestjs/common';
import { DbBackupService } from './db-backup.service';

@Module({
  providers: [DbBackupService],
})
export class DbBackupModule {}
