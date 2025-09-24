import { Test, TestingModule } from '@nestjs/testing';
import { FirstTimersService } from './first-timers.service';

describe('FirstTimersService', () => {
  let service: FirstTimersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FirstTimersService],
    }).compile();

    service = module.get<FirstTimersService>(FirstTimersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
