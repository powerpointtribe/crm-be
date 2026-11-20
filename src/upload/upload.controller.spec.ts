import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { StorageService } from '../common/services/storage.service';
import { MembersService } from '../members/members.service';
import {
  PortalAccount,
  PortalAccountStatus,
} from '../portal/schemas/portal-account.schema';
import { PortalJwtStrategy } from '../portal/strategies/portal-jwt.strategy';
import { UploadController } from './upload.controller';
import { detectImageKind } from './utils/image-signature.util';

const SECRET = 'test-secret-for-upload-spec';
const MEMBER_ID = '64b000000000000000000001';
const PORTAL_ID = '64b000000000000000000002';

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48,
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(12),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);
/** An HTML file pretending to be a PNG. */
const FAKE = Buffer.from('<html><script>alert(1)</script></html>');

describe('detectImageKind', () => {
  it('recognises JPEG, PNG and WebP by their bytes', () => {
    expect(detectImageKind(JPEG)).toBe('jpeg');
    expect(detectImageKind(PNG)).toBe('png');
    expect(detectImageKind(WEBP)).toBe('webp');
  });

  it('rejects other content, short buffers and nothing', () => {
    expect(detectImageKind(FAKE)).toBeNull();
    expect(detectImageKind(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageKind(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageKind(undefined)).toBeNull();
  });
});

describe('UploadController (HTTP)', () => {
  let app: INestApplication;
  let memberToken: string;
  let portalToken: string;
  const storage = {
    uploadImage: jest.fn<Promise<string>, [unknown, string]>(),
  };
  const cloudinary = { getUploadSignature: jest.fn() };

  beforeEach(async () => {
    storage.uploadImage.mockReset().mockResolvedValue('https://cdn.test/x.jpg');
    cloudinary.getUploadSignature
      .mockReset()
      .mockReturnValue({ signature: 'sig', timestamp: 1 });

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [UploadController],
      providers: [
        JwtStrategy,
        PortalJwtStrategy,
        { provide: StorageService, useValue: storage },
        { provide: CloudinaryService, useValue: cloudinary },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => (k === 'JWT_SECRET' ? SECRET : undefined),
          },
        },
        {
          provide: MembersService,
          useValue: {
            findById: (id: string) =>
              Promise.resolve(
                id === MEMBER_ID
                  ? { _id: id, isActive: true, role: 'role-1' }
                  : null,
              ),
          },
        },
        {
          provide: getModelToken(PortalAccount.name),
          useValue: {
            findById: (id: string) =>
              Promise.resolve(
                id === PORTAL_ID
                  ? { _id: id, status: PortalAccountStatus.ACTIVE }
                  : null,
              ),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same as main.ts, so X-Forwarded-For sets req.ip.
    (app.getHttpAdapter().getInstance() as import('express').Express).set(
      'trust proxy',
      1,
    );
    await app.init();

    const jwt = new JwtService({ secret: SECRET });
    memberToken = jwt.sign({ sub: MEMBER_ID, role: 'role-1' });
    portalToken = jwt.sign({ sub: PORTAL_ID, typ: 'portal' });
  });

  afterEach(() => app.close());

  const upload = (
    buf: Buffer,
    opts: { token?: string; folder?: string; ip?: string } = {},
  ) => {
    const req = request(app.getHttpServer())
      .post('/upload/image')
      .set('X-Forwarded-For', opts.ip ?? '10.0.0.1');
    if (opts.token) req.set('Authorization', `Bearer ${opts.token}`);
    if (opts.folder) req.field('folder', opts.folder);
    return req.attach('file', buf, {
      filename: 'a.png',
      contentType: 'image/png',
    });
  };

  describe('POST /upload/sign', () => {
    it('401 without a token (was public)', async () => {
      await request(app.getHttpServer()).post('/upload/sign').expect(401);
      expect(cloudinary.getUploadSignature).not.toHaveBeenCalled();
    });

    it('401 with a bad token', async () => {
      await request(app.getHttpServer())
        .post('/upload/sign')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('works with a staff token', async () => {
      const res = await request(app.getHttpServer())
        .post('/upload/sign')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(201);
      expect((res.body as { signature: string }).signature).toBe('sig');
    });

    it('works with a portal token', async () => {
      await request(app.getHttpServer())
        .post('/upload/sign')
        .set('Authorization', `Bearer ${portalToken}`)
        .expect(201);
    });
  });

  describe('POST /upload/image', () => {
    it('anonymous upload still works, but lands under public-uploads/', async () => {
      const res = await upload(PNG, {
        folder: 'powerpoint/first-timers',
      }).expect(201);
      expect((res.body as { url: string }).url).toBe('https://cdn.test/x.jpg');
      expect(storage.uploadImage).toHaveBeenCalledWith(
        expect.anything(),
        'public-uploads/powerpoint/first-timers',
      );
    });

    it('anonymous upload without a folder uses the default under public-uploads/', async () => {
      await upload(JPEG).expect(201);
      expect(storage.uploadImage).toHaveBeenCalledWith(
        expect.anything(),
        'public-uploads/powerpoint/uploads',
      );
    });

    it('anonymous folder cannot escape public-uploads/', async () => {
      await upload(PNG, { folder: '../../cmit/lessons' }).expect(201);
      expect(storage.uploadImage.mock.calls[0][1]).toBe(
        'public-uploads/cmit/lessons',
      );
    });

    it('a staff token keeps the requested folder', async () => {
      await upload(PNG, { token: memberToken, folder: 'cmit/lessons' }).expect(
        201,
      );
      expect(storage.uploadImage).toHaveBeenCalledWith(
        expect.anything(),
        'cmit/lessons',
      );
    });

    it('a portal token keeps the requested folder', async () => {
      await upload(WEBP, {
        token: portalToken,
        folder: 'cmit/assignments',
      }).expect(201);
      expect(storage.uploadImage).toHaveBeenCalledWith(
        expect.anything(),
        'cmit/assignments',
      );
    });

    it('an invalid token is treated as anonymous (no 401: the route was public)', async () => {
      await upload(PNG, { token: 'garbage', folder: 'x' }).expect(201);
      expect(storage.uploadImage).toHaveBeenCalledWith(
        expect.anything(),
        'public-uploads/x',
      );
    });

    it('rejects a file whose bytes are not an image, even with an image mimetype', async () => {
      const res = await upload(FAKE).expect(400);
      expect((res.body as { message: string }).message).toBe(
        'Only JPEG, PNG, and WebP images are allowed',
      );
      expect(storage.uploadImage).not.toHaveBeenCalled();
    });

    it('caps anonymous uploads at 5MB but allows signed-in uploads up to 10MB', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
      const res = await upload(big).expect(400);
      expect((res.body as { message: string }).message).toBe(
        'File size must be less than 5MB',
      );
      await upload(big, { token: memberToken }).expect(201);
    });

    it('limits anonymous uploads to 5 per minute per IP, with Retry-After', async () => {
      for (let i = 0; i < 5; i++)
        await upload(PNG, { ip: '10.9.9.9' }).expect(201);
      const res = await upload(PNG, { ip: '10.9.9.9' }).expect(429);
      expect(res.headers['retry-after']).toBeDefined();
      // Other IPs and signed-in callers are not affected.
      await upload(PNG, { ip: '10.9.9.8' }).expect(201);
      await upload(PNG, { ip: '10.9.9.9', token: memberToken }).expect(201);
    });

    it('lets the IP upload again once the minute has passed', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      for (let i = 0; i < 5; i++)
        await upload(PNG, { ip: '10.7.7.7' }).expect(201);
      await upload(PNG, { ip: '10.7.7.7' }).expect(429);
      now.mockReturnValue(1_000_000 + 60_001);
      await upload(PNG, { ip: '10.7.7.7' }).expect(201);
      now.mockRestore();
    });
  });
});
