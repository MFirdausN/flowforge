import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { WorkflowExecutor } from './engine/workflow.executor';
import { ExecutionEventsService } from './events/execution-events.service';

describe('ExecutionController', () => {
  let controller: ExecutionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [
        {
          provide: WorkflowExecutor,
          useValue: {
            executeWorkflow: jest.fn(),
            executeWebhookWorkflow: jest.fn(),
          },
        },
        {
          provide: ExecutionEventsService,
          useValue: {
            stream: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ExecutionController>(ExecutionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('rejects webhook payloads with invalid HMAC when secret is configured', () => {
    process.env.WEBHOOK_SECRET = 'test-secret';

    expect(() =>
      controller.webhook(
        'tenant-one',
        'workflow-1',
        { event: 'created' },
        'bad',
      ),
    ).toThrow(UnauthorizedException);

    delete process.env.WEBHOOK_SECRET;
  });
});
