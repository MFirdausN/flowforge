import { NotFoundException } from '@nestjs/common';
import { RunStatus, StepStatus } from '@prisma/client';
import { CycleDetector } from '../dag/cycle-detector';
import { DagValidator } from '../dag/dag.validator';
import { WorkflowDefinition } from '../dag/dag.types';
import { TopologicalSort } from '../dag/topological-sort';
import { ExecutionEventsService } from '../events/execution-events.service';
import { WorkflowExecutor } from './workflow.executor';

describe('WorkflowExecutor', () => {
  const definition: WorkflowDefinition = {
    name: 'Executor workflow',
    timeout_ms: 1_000,
    nodes: [
      {
        id: 'step-1',
        name: 'Fetch data',
        type: 'http',
        config: { url: 'https://example.test' },
        retry: { max_attempts: 2, backoff_ms: 1 },
      },
    ],
    edges: [],
  };

  const createPrismaMock = () => ({
    workflow: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'workflow-1',
        tenantId: 'tenant-1',
        versions: [{ id: 'version-1', definitionJson: definition }],
      }),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    workflowRun: {
      create: jest.fn().mockResolvedValue({
        id: 'run-1',
        startedAt: new Date('2026-04-23T10:00:00Z'),
      }),
      update: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        id: 'run-1',
        steps: [],
        logs: [],
      }),
    },
    workflowRunStep: {
      create: jest.fn().mockResolvedValue({
        id: 'step-record-1',
        startedAt: new Date('2026-04-23T10:00:00Z'),
      }),
      update: jest.fn(),
    },
    executionLog: {
      create: jest.fn(),
    },
  });

  const createExecutor = (overrides: Partial<any> = {}) => {
    const prisma = overrides.prisma ?? createPrismaMock();
    const httpStep = overrides.httpStep ?? {
      execute: jest.fn().mockResolvedValue({ ok: true }),
    };
    const scriptStep = overrides.scriptStep ?? {
      execute: jest.fn().mockResolvedValue({ result: 1 }),
    };
    const executionEventsService =
      overrides.executionEventsService ??
      ({
        emit: jest.fn(),
      } as Partial<ExecutionEventsService>);

    return {
      prisma,
      httpStep,
      executionEventsService,
      executor: new WorkflowExecutor(
        prisma,
        new DagValidator(),
        new CycleDetector(),
        new TopologicalSort(),
        httpStep,
        { execute: jest.fn().mockResolvedValue({ delayed: 1 }) },
        { execute: jest.fn().mockResolvedValue({ result: true }) },
        scriptStep,
        executionEventsService as ExecutionEventsService,
      ),
    };
  };

  it('creates succeeded run, step, and log records for a successful workflow', async () => {
    const { executor, prisma, httpStep, executionEventsService } =
      createExecutor();

    await executor.executeWorkflow('workflow-1', {
      tenantId: 'tenant-1',
      sub: 'user-1',
    });

    expect(httpStep.execute).toHaveBeenCalledWith({
      url: 'https://example.test',
    });
    expect(prisma.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerType: 'MANUAL',
          status: RunStatus.RUNNING,
          createdById: 'user-1',
        }),
      }),
    );
    expect(prisma.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RunStatus.SUCCEEDED }),
      }),
    );
    expect(prisma.workflowRunStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: StepStatus.SUCCEEDED }),
      }),
    );
    expect(executionEventsService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'run.started',
        runId: 'run-1',
      }),
    );
    expect(executionEventsService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'step.succeeded',
        runId: 'run-1',
      }),
    );
  });

  it('retries failed steps with exponential backoff before succeeding', async () => {
    const httpStep = {
      execute: jest
        .fn()
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValueOnce({ recovered: true }),
    };
    const { executor, prisma } = createExecutor({ httpStep });

    await executor.executeWorkflow('workflow-1', {
      tenantId: 'tenant-1',
      sub: 'user-1',
    });

    expect(httpStep.execute).toHaveBeenCalledTimes(2);
    expect(prisma.executionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          level: 'WARN',
          message: expect.stringContaining('retrying in 1ms'),
        }),
      }),
    );
    expect(prisma.workflowRunStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attemptNo: 2 }),
      }),
    );
  });

  it('marks a workflow as timeout when execution exceeds the deadline', async () => {
    const timeoutDefinition = {
      ...definition,
      timeout_ms: 1,
      nodes: [
        {
          id: 'slow-step',
          name: 'Slow step',
          type: 'delay',
          config: { ms: 50 },
        },
      ],
    } as WorkflowDefinition;
    const prisma = createPrismaMock();
    prisma.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1',
      tenantId: 'tenant-1',
      versions: [{ id: 'version-1', definitionJson: timeoutDefinition }],
    });
    const executor = new WorkflowExecutor(
      prisma as any,
      new DagValidator(),
      new CycleDetector(),
      new TopologicalSort(),
      { execute: jest.fn() },
      {
        execute: () => new Promise((resolve) => setTimeout(resolve, 50)),
      } as any,
      { execute: jest.fn() },
      { execute: jest.fn() },
      { emit: jest.fn() } as any,
    );

    await expect(
      executor.executeWorkflow('workflow-1', {
        tenantId: 'tenant-1',
        sub: 'user-1',
      }),
    ).rejects.toThrow('Workflow timed out after 1ms');

    expect(prisma.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RunStatus.TIMEOUT }),
      }),
    );
  });

  it('resolves tenant slug for webhook-triggered workflows', async () => {
    const { executor, prisma } = createExecutor();
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });

    await executor.executeWebhookWorkflow('tenant-one', 'workflow-1', {
      event: 'created',
    });

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { slug: 'tenant-one' },
      select: { id: true },
    });
    expect(prisma.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerType: 'WEBHOOK',
          inputPayload: { event: 'created' },
        }),
      }),
    );
  });

  it('throws not found when workflow does not belong to the tenant', async () => {
    const prisma = createPrismaMock();
    prisma.workflow.findFirst.mockResolvedValue(null);
    const { executor } = createExecutor({ prisma });

    await expect(
      executor.executeWorkflow('workflow-1', {
        tenantId: 'tenant-2',
        sub: 'user-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('skips the non-matching conditional branch', async () => {
    const conditionalDefinition: WorkflowDefinition = {
      name: 'Conditional workflow',
      timeout_ms: 1_000,
      nodes: [
        {
          id: 'check',
          name: 'Check value',
          type: 'condition',
          config: { value: true },
        },
        {
          id: 'true-branch',
          name: 'True branch',
          type: 'delay',
          config: { ms: 1 },
        },
        {
          id: 'false-branch',
          name: 'False branch',
          type: 'delay',
          config: { ms: 1 },
        },
      ],
      edges: [
        { from: 'check', to: 'true-branch', condition: true },
        { from: 'check', to: 'false-branch', condition: false },
      ],
    };
    const prisma = createPrismaMock();
    prisma.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1',
      tenantId: 'tenant-1',
      versions: [{ id: 'version-1', definitionJson: conditionalDefinition }],
    });
    const { executor } = createExecutor({ prisma });

    await executor.executeWorkflow('workflow-1', {
      tenantId: 'tenant-1',
      sub: 'user-1',
    });

    expect(prisma.workflowRunStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepId: 'false-branch',
          status: StepStatus.SKIPPED,
        }),
      }),
    );
  });

  it('executes sandboxed script steps', async () => {
    const scriptStep = { execute: jest.fn().mockResolvedValue({ result: 42 }) };
    const scriptDefinition: WorkflowDefinition = {
      name: 'Script workflow',
      timeout_ms: 1_000,
      nodes: [
        {
          id: 'calculate',
          name: 'Calculate',
          type: 'script',
          config: { code: 'result = input.value * 2;', input: { value: 21 } },
        },
      ],
      edges: [],
    };
    const prisma = createPrismaMock();
    prisma.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1',
      tenantId: 'tenant-1',
      versions: [{ id: 'version-1', definitionJson: scriptDefinition }],
    });
    const executor = new WorkflowExecutor(
      prisma as any,
      new DagValidator(),
      new CycleDetector(),
      new TopologicalSort(),
      { execute: jest.fn() },
      { execute: jest.fn() },
      { execute: jest.fn() },
      scriptStep,
      { emit: jest.fn() } as any,
    );

    await executor.executeWorkflow('workflow-1', {
      tenantId: 'tenant-1',
      sub: 'user-1',
    });

    expect(scriptStep.execute).toHaveBeenCalledWith({
      code: 'result = input.value * 2;',
      input: { value: 21 },
    });
  });
});
