import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  Req,
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
import {
  OptionalUploadAuthGuard,
  UploadAuthGuard,
} from './guards/upload-auth.guard';
import { AnonymousUploadLimitGuard } from './guards/anonymous-upload-limit.guard';
import { detectImageKind } from './utils/image-signature.util';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequireAnyPermission } from '../roles/decorators/require-permission.decorator';

/** Website content images (staff): bigger than the public cap. */
export const WEBSITE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

/** Anonymous uploads: smaller cap, and kept apart from staff/portal uploads. */
export const ANONYMOUS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ANONYMOUS_UPLOAD_ROOT = 'public-uploads';

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

  @UseGuards(UploadAuthGuard)
  @ApiBearerAuth()
  @Post('sign')
  @ApiOperation({
    summary:
      'Get a Cloudinary upload signature for direct browser upload (staff or portal token required)',
  })
  @ApiResponse({ status: 401, description: 'No valid staff or portal token' })
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
  @UseGuards(OptionalUploadAuthGuard, AnonymousUploadLimitGuard)
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload an image (JPEG, PNG or WebP)',
    description:
      'Public, so public forms keep working. With a valid staff or portal token: up to 10 MB, ' +
      'stored under the given folder. Without one: up to 5 MB, 5 uploads per minute per IP, ' +
      'stored under "public-uploads/<folder>".',
  })
  @ApiResponse({ status: 429, description: 'Too many anonymous uploads' })
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
    @Body('folder') folder: string | undefined,
    @Req() req: { user?: unknown },
  ) {
    const anonymous = !req.user;
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

    // The mimetype is client-supplied: check the actual bytes too.
    if (!detectImageKind(file.buffer)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }

    // Validate file size (10MB signed in, 5MB anonymous)
    const maxSize = anonymous ? ANONYMOUS_IMAGE_MAX_BYTES : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size must be less than ${anonymous ? 5 : 10}MB`,
      );
    }

    const target = this.sanitizeFolder(folder, 'powerpoint/uploads');

    try {
      const imageUrl = await this.storage.uploadImage(
        file,
        anonymous ? `${ANONYMOUS_UPLOAD_ROOT}/${target}` : target,
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

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyPermission('website:upload', 'lost-found:create')
  @ApiBearerAuth()
  @Post('website-image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: WEBSITE_IMAGE_MAX_BYTES } }),
  )
  @ApiOperation({
    summary: 'Upload a website image (staff)',
    description:
      'For website content (series artwork, posters, pastor photos, lost-item photos). ' +
      'JPEG, PNG or WebP, checked by content; up to 15 MB. Kept in its original format and ' +
      'never cropped (only images over 2560px are shrunk; metadata is stripped). ' +
      'Stored under "website/<folder>". Needs website:upload or lost-found:create.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', example: 'series' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        bytes: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No valid staff token' })
  @ApiResponse({ status: 403, description: 'Missing permission' })
  async uploadWebsiteImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const kind = detectImageKind(file.buffer);
    if (!kind) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }
    if (file.size > WEBSITE_IMAGE_MAX_BYTES) {
      throw new BadRequestException('File size must be less than 15MB');
    }
    // Storage picks the output format from the mimetype: use what the bytes
    // say, not what the client claimed.
    file.mimetype = `image/${kind}`;
    try {
      return await this.storage.uploadWebsiteImage(
        file,
        `website/${this.sanitizeFolder(folder, 'uploads')}`,
      );
    } catch (error) {
      const err = error as { message?: string };
      throw new BadRequestException(
        `Failed to upload image: ${err?.message || 'unknown error'}`,
      );
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
