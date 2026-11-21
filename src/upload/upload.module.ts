import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { R2StorageService } from '../common/services/r2-storage.service';
import { StorageService } from '../common/services/storage.service';
import { RolesModule } from '../roles/roles.module';

@Module({
  // RolesModule provides PermissionGuard's models for /upload/website-image.
  imports: [RolesModule],
  controllers: [UploadController],
  providers: [CloudinaryService, R2StorageService, StorageService],
  exports: [StorageService, CloudinaryService],
})
export class UploadModule {}
