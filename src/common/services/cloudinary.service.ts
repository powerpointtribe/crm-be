import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'church-management',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [
              { width: 500, height: 500, crop: 'limit' },
              { quality: 'auto:good' },
              { format: 'jpg' },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (result?.secure_url) {
              resolve(result.secure_url);
            } else {
              reject(new Error('Upload failed: No secure URL returned'));
            }
          },
        )
        .end(file.buffer);
    });
  }

  /**
   * Upload an arbitrary file (documents, video, audio…) preserving the
   * original. `resourceType` should be 'raw' for docs, 'video' for video/audio,
   * or 'auto' to let Cloudinary decide. Returns the secure URL + metadata.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'church-management/lms',
    resourceType: 'raw' | 'video' | 'auto' = 'auto',
  ): Promise<{ url: string; publicId: string; format?: string; bytes?: number }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (result?.secure_url) {
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                bytes: result.bytes,
              });
            } else {
              reject(new Error('Upload failed: No secure URL returned'));
            }
          },
        )
        .end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve();
        } else {
          reject(new Error('Delete failed: No result returned'));
        }
      });
    });
  }
}
