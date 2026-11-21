import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';

import * as request from 'supertest';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { StorageService } from '../common/services/storage.service';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { staffAuthHarness } from '../test-utils/staff-auth-spec';
import { UploadController } from './upload.controller';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const FAKE = Buffer.from('<svg onload="alert(1)"></svg>............');

describe('POST /upload/website-image (integration)', () => {
  let db: Awaited<ReturnType<typeof openTestDb>>;
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  const storage = {
    uploadWebsiteImage: jest.fn<
      Promise<{ url: string; width: number; height: number; bytes: number }>,
      [Express.Multer.File, string]
    >(),
    uploadImage: jest.fn(),
  };

  beforeAll(async () => {
    db = await openTestDb('upload_website');
    const auth = staffAuthHarness(db.connection);
    staff = auth.staff;
    await db.ready();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [UploadController],
      providers: [
        PermissionGuard,
        ...auth.providers,
        { provide: StorageService, useValue: storage },
        { provide: CloudinaryService, useValue: {} },
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();
  });

  beforeEach(() => {
    storage.uploadWebsiteImage.mockReset().mockResolvedValue({
      url: 'https://cdn.test/website/series/a.png',
      width: 1920,
      height: 1080,
      bytes: 1234,
    });
    storage.uploadImage.mockReset();
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const post = (
    buf: Buffer,
    opts: { token?: string; folder?: string; type?: string } = {},
  ) => {
    const req = request(app.getHttpServer()).post('/upload/website-image');
    if (opts.token) req.set('Authorization', `Bearer ${opts.token}`);
    if (opts.folder) req.field('folder', opts.folder);
    return req.attach('file', buf, {
      filename: 'art.png',
      contentType: opts.type ?? 'image/png',
    });
  };

  it('401 without a token', async () => {
    await post(PNG).expect(401);
    expect(storage.uploadWebsiteImage).not.toHaveBeenCalled();
  });

  it('403 without website:upload or lost-found:create', async () => {
    const { token } = await staff(['website:view-content']);
    await post(PNG, { token }).expect(403);
  });

  it('website:upload: stores under website/<folder>, no cropping path, returns url + size', async () => {
    const { token } = await staff(['website:upload']);
    const res = await post(PNG, { token, folder: 'series' }).expect(201);
    expect(res.body).toEqual({
      url: 'https://cdn.test/website/series/a.png',
      width: 1920,
      height: 1080,
      bytes: 1234,
    });
    expect(storage.uploadWebsiteImage).toHaveBeenCalledWith(
      expect.anything(),
      'website/series',
    );
    // The cropping public path is never used for website images.
    expect(storage.uploadImage).not.toHaveBeenCalled();
  });

  it('lost-found:create may upload too (lost-item photos)', async () => {
    const { token } = await staff(['lost-found:create']);
    await post(PNG, { token, folder: 'lost-items' }).expect(201);
    expect(storage.uploadWebsiteImage.mock.calls[0][1]).toBe(
      'website/lost-items',
    );
  });

  it('default folder, and folders cannot escape website/', async () => {
    const { token } = await staff(['website:upload']);
    await post(PNG, { token }).expect(201);
    await post(PNG, { token, folder: '../../cmit/lessons' }).expect(201);
    expect(storage.uploadWebsiteImage.mock.calls.map((c) => c[1])).toEqual([
      'website/uploads',
      'website/cmit/lessons',
    ]);
  });

  it('uses the type found in the bytes, not the one the client claimed', async () => {
    const { token } = await staff(['website:upload']);
    await post(PNG, { token, type: 'image/jpeg' }).expect(201);
    expect(storage.uploadWebsiteImage.mock.calls[0][0].mimetype).toBe(
      'image/png',
    );
  });

  it('400 for content that is not JPEG/PNG/WebP, even with an image mimetype', async () => {
    const { token } = await staff(['website:upload']);
    const res = await post(FAKE, { token }).expect(400);
    expect((res.body as { message: string }).message).toBe(
      'Only JPEG, PNG, and WebP images are allowed',
    );
    expect(storage.uploadWebsiteImage).not.toHaveBeenCalled();
  });

  it('400 with no file', async () => {
    const { token } = await staff(['website:upload']);
    await request(app.getHttpServer())
      .post('/upload/website-image')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('allows up to 15 MB (more than the 5 MB public cap); rejects larger', async () => {
    const { token } = await staff(['website:upload']);
    await post(Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), {
      token,
    }).expect(201);
    await post(Buffer.concat([PNG, Buffer.alloc(16 * 1024 * 1024)]), {
      token,
    }).expect(413);
  });
});
