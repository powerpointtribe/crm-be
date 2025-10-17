import { Module } from '@nestjs/common';
import { AccessControlService } from './services/access-control.service';

@Module({
  providers: [AccessControlService],
  exports: [AccessControlService],
})
export class CommonModule {}
