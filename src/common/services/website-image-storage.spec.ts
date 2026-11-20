import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { Sharp } from 'sharp';
import { CloudinaryService } from './cloudinary.service';
import { R2StorageService, WEBSITE_IMAGE_MAX_EDGE } from './r2-storage.service';
import { StorageService } from './storage.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as (input?: unknown) => Sharp;

const blank = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 9, g: 9, b: 9 } },
  });

const fileOf = (buffer: Buffer, mimetype: string) =>
  ({
    buffer,
    mimetype,
    originalname: 'art.x',
    size: buffer.length,
  }) as Express.Multer.File;

const config = (values: Record<string, string>) =>
  ({
    get: (k: string, d?: string) => values[k] ?? d,
  }) as unknown as ConfigService;

describe('website image storage (never crops)', () => {
  describe('R2', () => {
    const r2 = new R2StorageService(
      config({
        R2_ENDPOINT: 'https://r2.test',
        R2_ACCESS_KEY_ID: 'k',
        R2_SECRET_ACCESS_KEY: 's',
        R2_BUCKET: 'b',
        R2_PUBLIC_BASE_URL: 'https://media.test',
      }),
    );
    let send: jest.SpyInstance;

    beforeEach(() => {
      send = jest
        .spyOn(S3Client.prototype, 'send')
        .mockResolvedValue({} as never);
    });
    afterEach(() => send.mockRestore());

    const sent = () => (send.mock.calls[0][0] as PutObjectCommand).input;

    it('shrinks a wide image to the max edge, keeping its aspect ratio and format', async () => {
      const png = await blank(3000, 1000).png().toBuffer();
      const res = await r2.uploadWebsiteImage(
        fileOf(png, 'image/png'),
        'website/series',
      );
      expect(res).toMatchObject({
        width: WEBSITE_IMAGE_MAX_EDGE,
        height: 853,
      });
      expect(res.url).toMatch(
        /^https:\/\/media\.test\/website\/series\/.+\.png$/,
      );
      expect(sent().ContentType).toBe('image/png');
      const meta = await sharp(sent().Body).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([
        2560,
        853,
        'png',
      ]);
    });

    it('leaves smaller images at full size (unlike the 500x500 public path)', async () => {
      const jpg = await blank(1200, 900).jpeg().toBuffer();
      const res = await r2.uploadWebsiteImage(fileOf(jpg, 'image/jpeg'));
      expect([res.width, res.height]).toEqual([1200, 900]);
      expect(sent().ContentType).toBe('image/jpeg');
    });

    it('keeps WebP as WebP', async () => {
      const webp = await blank(640, 360).webp().toBuffer();
      await r2.uploadWebsiteImage(fileOf(webp, 'image/webp'));
      expect(sent().ContentType).toBe('image/webp');
      expect(sent().Key).toMatch(/\.webp$/);
    });
  });

  describe('Cloudinary', () => {
    it('only limits the longest edge: no 500x500 box, no forced JPG', async () => {
      let options: Record<string, unknown> = {};
      const spy = jest
        .spyOn(cloudinary.uploader, 'upload_stream')
        .mockImplementation(((
          opts: Record<string, unknown>,
          cb: (e: unknown, r: unknown) => void,
        ) => {
          options = opts;
          return {
            end: () =>
              cb(undefined, {
                secure_url: 'https://res.test/a.png',
                width: 10,
                height: 20,
                bytes: 30,
              }),
          };
        }) as never);
      const svc = new CloudinaryService(config({}));
      const res = await svc.uploadWebsiteImage(
        fileOf(Buffer.from('x'), 'image/png'),
        'website/x',
      );
      spy.mockRestore();
      expect(res).toEqual({
        url: 'https://res.test/a.png',
        width: 10,
        height: 20,
        bytes: 30,
      });
      expect(options).toMatchObject({
        folder: 'website/x',
        resource_type: 'image',
      });
      const steps = JSON.stringify(options.transformation);
      expect(steps).toContain('"crop":"limit"');
      expect(steps).toContain(`"width":${WEBSITE_IMAGE_MAX_EDGE}`);
      expect(steps).not.toContain('"width":500');
      expect(steps).not.toContain('"format"');
    });
  });

  it('StorageService routes to R2 when configured, else Cloudinary', async () => {
    const r2 = {
      isConfigured: true,
      uploadWebsiteImage: jest.fn().mockResolvedValue({ url: 'r2' }),
    };
    const cl = {
      uploadWebsiteImage: jest.fn().mockResolvedValue({ url: 'cl' }),
    };
    const f = fileOf(Buffer.from('x'), 'image/png');
    await expect(
      new StorageService(cl as never, r2 as never).uploadWebsiteImage(f, 'w'),
    ).resolves.toEqual({ url: 'r2' });
    await expect(
      new StorageService(
        cl as never,
        { ...r2, isConfigured: false } as never,
      ).uploadWebsiteImage(f, 'w'),
    ).resolves.toEqual({ url: 'cl' });
  });
});
