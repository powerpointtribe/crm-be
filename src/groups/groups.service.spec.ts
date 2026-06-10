import { Test, TestingModule } from '@nestjs/testing';
import { GroupsService } from './groups.service';

// Auto-mock any unresolved dependency so this smoke test can instantiate the
// target without wiring every collaborator by hand. Each injection token
// resolves to a Proxy whose property access returns a jest.fn().
const autoMock = (): any =>
  new Proxy({} as any, {
    get: (target: any, prop: any) => {
      if (prop === 'then') return undefined;
      if (!(prop in target)) target[prop] = jest.fn();
      return target[prop];
    },
  });

describe('GroupsService', () => {
  let subject: GroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupsService],
    })
      .useMocker(autoMock)
      .compile();

    subject = module.get<GroupsService>(GroupsService);
  });

  it('should be defined', () => {
    expect(subject).toBeDefined();
  });
});
