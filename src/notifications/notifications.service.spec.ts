import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';

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

describe('NotificationsService', () => {
  let subject: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService],
    })
      .useMocker(autoMock)
      .compile();

    subject = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(subject).toBeDefined();
  });
});
