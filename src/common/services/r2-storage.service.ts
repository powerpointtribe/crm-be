import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import type { Sharp } from 'sharp';
// sharp is CommonJS at runtime (module.exports = fn) with ESM-style types. A
// default import compiles to `sharp.default` (undefined → "not a function")
// unless esModuleInterop is on — but enabling that globally breaks other
// `import * as x` CommonJS callables (e.g. compression). Requiring it here keeps
// the fix local and interop-independent.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp') as (input?: Buffer) => Sharp;

/**
 * Cloudflare R2 storage (S3-compatible). Drop-in replacement for
 * CloudinaryService with matching method signatures. R2 has no on-the-fly
 * transformations, so images are optimized here with sharp at upload time.
 *
 * Objects are served from a public base URL (custom domain or the bucket's
 * r2.dev URL), configured via R2_PUBLIC_BASE_URL.
 *
 * Env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 * R2_PUBLIC_BASE_URL. Degrades gracefully (503) when not configured.
 */
@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly endpoint?: string;
  private readonly accessKeyId?: string;
  private readonly secretAccessKey?: string;
  private readonly bucket?: string;
  private readonly publicBase?: string;
  private _s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    this.endpoint = config.get<string>('R2_ENDPOINT');
    this.accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    this.secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucket = config.get<string>('R2_BUCKET');
    this.publicBase = config
      .get<string>('R2_PUBLIC_BASE_URL', '')
      .replace(/\/+$/, '');
  }

  get isConfigured(): boolean {
    return !!(
      this.endpoint &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.bucket &&
      this.publicBase
    );
  }

  /** Lazily build the S3 client so an unconfigured instance never throws. */
  private get s3(): S3Client {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, ' +
          'R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_BASE_URL.',
      );
    }
    if (!this._s3) {
      this._s3 = new S3Client({
        region: 'auto',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId as string,
          secretAccessKey: this.secretAccessKey as string,
        },
      });
    }
    return this._s3;
  }

  private buildKey(folder: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${folder}/${Date.now()}-${randomBytes(4).toString('hex')}-${safe}`;
  }

  private publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  /**
   * Optimize (resize/compress with sharp) and store an image. Mirrors
   * CloudinaryService.uploadImage — returns the public URL string.
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'church-management',
  ): Promise<string> {
    const optimized = await sharp(file.buffer)
      .rotate() // honour EXIF orientation
      .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const base = file.originalname.replace(/\.[^.]+$/, '') || 'image';
    const key = this.buildKey(folder, `${base}.jpg`);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/jpeg',
      }),
    );
    return this.publicUrl(key);
  }

  /**
   * Store an arbitrary file (document, video, audio…) unchanged. Mirrors
   * CloudinaryService.uploadFile. `publicId` is the object key (used to delete).
   * Pass `asAttachment` to force a download instead of inline display.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder = 'church-management/lms',
    opts: { asAttachment?: boolean } = {},
  ): Promise<{
    url: string;
    publicId: string;
    format?: string;
    bytes?: number;
  }> {
    const key = this.buildKey(folder, file.originalname);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ...(opts.asAttachment
          ? {
              ContentDisposition: `attachment; filename="${file.originalname.replace(/"/g, '')}"`,
            }
          : {}),
      }),
    );
    return {
      url: this.publicUrl(key),
      publicId: key,
      format: file.originalname.split('.').pop(),
      bytes: file.size,
    };
  }

  /** Delete an object by its key (the `publicId` returned from uploadFile). */
  async deleteImage(publicId: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: publicId }),
    );
  }

  /**
   * Presigned PUT URL for direct browser → R2 upload (avoids proxying large
   * files through the API). Returns the temporary upload URL plus the final
   * public URL the client should persist.
   */
  async createPresignedUpload(
    folder = 'church-management',
    filename = 'file',
    contentType = 'application/octet-stream',
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const key = this.buildKey(folder, filename);
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 600 },
    );
    return { uploadUrl, key, publicUrl: this.publicUrl(key) };
  }
}
