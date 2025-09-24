import { Test, TestingModule } from '@nestjs/testing';
import { FirstTimersController } from './first-timers.controller';

describe('FirstTimersController', () => {
  let controller: FirstTimersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FirstTimersController],
    }).compile();

    controller = module.get<FirstTimersController>(FirstTimersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
