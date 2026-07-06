import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { R2StorageService } from '../common/services/r2-storage.service';
import { StorageService } from '../common/services/storage.service';

@Module({
  controllers: [UploadController],
  providers: [CloudinaryService, R2StorageService, StorageService],
  exports: [StorageService, CloudinaryService],
})
export class UploadModule {}
