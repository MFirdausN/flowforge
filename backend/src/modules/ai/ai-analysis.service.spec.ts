import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiAnalysisService } from './ai-analysis.service';

describe('AiAnalysisService', () => {
  const createService = async (run: any) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAnalysisService,
        {
          provide: PrismaService,
          useValue: {
            workflowRun: {
              findFirst: jest.fn().mockResolvedValue(run),
            },
          },
        },
      ],
    }).compile();

    return module.get<AiAnalysisService>(AiAnalysisService);
  };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('returns heuristic timeout analysis without an API key', async () => {
    const service = await createService({
      id: 'run-1',
      workflowId: 'workflow-1',
      status: RunStatus.TIMEOUT,
      triggerType: 'MANUAL',
      errorMessage: 'Workflow timed out after 1000ms',
      durationMs: 1000,
      workflow: { name: 'Slow workflow' },
      logs: [],
      steps: [
        {
          stepId: 'wait',
          stepType: 'delay',
          status: 'FAILED',
          errorMessage: 'Workflow timed out after 1000ms',
          logs: [],
        },
      ],
    });

    const analysis = await service.analyzeRunFailure('run-1', 'tenant-1');

    expect(analysis.source).toBe('heuristic');
    expect(analysis.confidence).toBe('high');
    expect(analysis.likelyCause).toContain('timeout');
    expect(analysis.suggestedFix).toContain('timeout_ms');
  });

  it('throws not found when run does not belong to tenant', async () => {
    const service = await createService(null);

    await expect(service.analyzeRunFailure('run-1', 'tenant-2')).rejects.toThrow(
      NotFoundException,
    );
  });
});
