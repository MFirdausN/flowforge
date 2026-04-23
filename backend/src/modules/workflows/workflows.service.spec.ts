import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { CycleDetector } from '../execution/dag/cycle-detector';
import { DagValidator } from '../execution/dag/dag.validator';
import { TopologicalSort } from '../execution/dag/topological-sort';
import { CronMatcher } from '../execution/scheduler/cron-matcher';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsService', () => {
  let service: WorkflowsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: DagValidator,
          useValue: {
            validate: jest.fn(),
          },
        },
        {
          provide: CycleDetector,
          useValue: {
            detect: jest.fn(),
          },
        },
        {
          provide: TopologicalSort,
          useValue: {
            sort: jest.fn(),
          },
        },
        {
          provide: CronMatcher,
          useValue: {
            isValid: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
