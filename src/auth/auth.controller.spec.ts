import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';

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

describe('AuthController', () => {
  let subject: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    })
      .useMocker(autoMock)
      .compile();

    subject = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(subject).toBeDefined();
  });
});
