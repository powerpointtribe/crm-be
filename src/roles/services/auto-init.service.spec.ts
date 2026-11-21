import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Branch } from '../../branches/schemas/branch.schema';
import { MembersService } from '../../members/members.service';
import { autoMock } from '../../test-utils/auto-mock-spec';
import { AutoInitService } from './auto-init.service';

describe('AutoInitService super admin bootstrap', () => {
  it('passes the plain password to MembersService.create, which hashes it once', async () => {
    const env: Record<string, string> = {
      SUPER_ADMIN_EMAIL: 'admin@example.test',
      SUPER_ADMIN_PASSWORD: 'Sup3r-Secret!',
    };
    const create = jest.fn().mockResolvedValue({ _id: new Types.ObjectId() });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AutoInitService,
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: string) => env[k] ?? d },
        },
        {
          provide: MembersService,
          useValue: { findByEmail: jest.fn().mockResolvedValue(null), create },
        },
        {
          provide: getModelToken(Branch.name),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
      ],
    })
      .useMocker(autoMock)
      .compile();

    const service = moduleRef.get(AutoInitService);
    await (
      service as unknown as { assignSuperAdminRole(): Promise<void> }
    ).assignSuperAdminRole();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      email: 'admin@example.test',
      password: 'Sup3r-Secret!',
    });
  });
});
