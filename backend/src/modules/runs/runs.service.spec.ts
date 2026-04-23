import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { RunsService } from './runs.service';

describe('RunsService', () => {
  let service: RunsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunsService,
        {
          provide: PrismaService,
          useValue: {
            workflowRun: {
              count: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<RunsService>(RunsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
