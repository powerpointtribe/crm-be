import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { StorageService } from '../common/services/storage.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly storage: StorageService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Sanitize a caller-supplied storage folder. Callers pass a context path so
   * uploads are organised (e.g. 'cmit/lessons', 'powerpoint/first-timers').
   * Only [a-z0-9/_-] survive, dots are stripped (no traversal), depth is capped;
   * falls back when nothing usable is given. Safe for the public image endpoint.
   */
  private sanitizeFolder(raw: string | undefined, fallback: string): string {
    const cleaned = (raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9/_-]+/g, '-')
      .replace(/\/{2,}/g, '/')
      .replace(/^[/-]+|[/-]+$/g, '')
      .split('/')
      .filter(Boolean)
      .slice(0, 4)
      .join('/');
    return cleaned || fallback;
  }

  @Public()
  @Post('sign')
  @ApiOperation({
    summary: 'Get a Cloudinary upload signature for direct browser upload',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        signature: { type: 'string' },
        timestamp: { type: 'number' },
        folder: { type: 'string' },
        cloudName: { type: 'string' },
        apiKey: { type: 'string' },
      },
    },
  })
  getUploadSignature() {
    return this.cloudinaryService.getUploadSignature('church-management');
  }

  @Public()
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Upload an image to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The Cloudinary URL of the uploaded image',
        },
      },
    },
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    try {
      const imageUrl = await this.storage.uploadImage(
        file,
        this.sanitizeFolder(folder, 'powerpoint/uploads'),
      );
      return {
        url: imageUrl,
      };
    } catch (error) {
      // Surface the real cause (e.g. "cloud_name is disabled") instead of a
      // generic message, so upload failures are diagnosable.
      const err = error as { message?: string; error?: { message?: string } };
      const reason = err?.message || err?.error?.message || 'unknown error';
      throw new BadRequestException(`Failed to upload image: ${reason}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('document')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a document (PDF, slides, docs) to Cloudinary',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, Word, PowerPoint, Excel, text and CSV files are allowed',
      );
    }

    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 25MB');
    }

    try {
      const result = await this.storage.uploadFile(
        file,
        this.sanitizeFolder(folder, 'powerpoint/documents'),
        'raw',
      );
      return result;
    } catch (error) {
      throw new BadRequestException('Failed to upload document');
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('video')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a video or audio file to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (
      !file.mimetype.startsWith('video/') &&
      !file.mimetype.startsWith('audio/')
    ) {
      throw new BadRequestException('Only video or audio files are allowed');
    }

    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 200MB');
    }

    try {
      const result = await this.storage.uploadFile(
        file,
        this.sanitizeFolder(folder, 'powerpoint/videos'),
        'video',
      );
      return result;
    } catch (error) {
      throw new BadRequestException('Failed to upload media');
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('presign')
  @ApiOperation({
    summary:
      'Get a presigned URL for a direct browser → storage upload (R2 only). ' +
      'Falls back with 503 when R2 is not the active provider.',
  })
  async presignUpload(
    @Body()
    body: {
      folder?: string;
      filename?: string;
      contentType?: string;
    },
  ) {
    if (!this.storage.supportsPresignedUpload) {
      throw new BadRequestException(
        'Presigned uploads require Cloudflare R2 to be configured.',
      );
    }
    return this.storage.createPresignedUpload(
      body?.folder || 'church-management',
      body?.filename || 'file',
      body?.contentType || 'application/octet-stream',
    );
  }
}
