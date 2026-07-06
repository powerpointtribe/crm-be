import { Injectable, Logger } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { R2StorageService } from './r2-storage.service';

/**
 * Storage facade — routes media uploads to Cloudflare R2 when it is configured
 * (R2_* env vars present), otherwise falls back to Cloudinary. This lets the
 * switch happen purely via config, with no downstream code changes and no
 * breakage before the R2 bucket is set up.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly useR2: boolean;

  constructor(
    private readonly cloudinary: CloudinaryService,
    private readonly r2: R2StorageService,
  ) {
    this.useR2 = this.r2.isConfigured;
    this.logger.log(
      `Media uploads using: ${this.useR2 ? 'Cloudflare R2' : 'Cloudinary'}`,
    );
  }

  get provider(): 'r2' | 'cloudinary' {
    return this.useR2 ? 'r2' : 'cloudinary';
  }

  get supportsPresignedUpload(): boolean {
    return this.useR2;
  }

  uploadImage(file: Express.Multer.File, folder?: string): Promise<string> {
    return this.useR2
      ? this.r2.uploadImage(file, folder)
      : this.cloudinary.uploadImage(file, folder);
  }

  uploadFile(
    file: Express.Multer.File,
    folder?: string,
    resourceType: 'raw' | 'video' | 'auto' = 'auto',
    opts: { asAttachment?: boolean } = {},
  ): Promise<{
    url: string;
    publicId: string;
    format?: string;
    bytes?: number;
  }> {
    return this.useR2
      ? this.r2.uploadFile(file, folder, opts)
      : this.cloudinary.uploadFile(file, folder, resourceType);
  }

  deleteImage(publicId: string): Promise<void> {
    return this.useR2
      ? this.r2.deleteImage(publicId)
      : this.cloudinary.deleteImage(publicId);
  }

  /** Presigned direct-upload (R2 only). Throws 503 if R2 isn't configured. */
  createPresignedUpload(
    folder?: string,
    filename?: string,
    contentType?: string,
  ) {
    return this.r2.createPresignedUpload(folder, filename, contentType);
  }
}
