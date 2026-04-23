import { Test, TestingModule } from '@nestjs/testing';
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
});
