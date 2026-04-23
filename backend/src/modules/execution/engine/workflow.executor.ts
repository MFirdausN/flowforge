import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DagValidator } from '../dag/dag.validator';
import { CycleDetector } from '../dag/cycle-detector';
import { TopologicalSort } from '../dag/topological-sort';
import {
  RetryConfig,
  WorkflowDefinition,
  WorkflowNode,
} from '../dag/dag.types';
import { HttpStep } from '../steps/http.step';
import { DelayStep } from '../steps/delay.step';
import { ConditionStep } from '../steps/condition.step';
import { ScriptStep } from '../steps/script.step';
import { RunStatus, StepStatus } from '@prisma/client';
import { serializeBigInt } from '../../../common/utils/serialize-bigint';
import { ExecutionEventsService } from '../events/execution-events.service';

class WorkflowTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Workflow timed out after ${timeoutMs}ms`);
    this.name = 'WorkflowTimeoutError';
  }
}

interface ExecuteWorkflowOptions {
  triggerType?: string;
  inputPayload?: Record<string, any>;
}

type NodeExecutionResult = {
  output: Record<string, any>;
};

@Injectable()
export class WorkflowExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dagValidator: DagValidator,
    private readonly cycleDetector: CycleDetector,
    private readonly topologicalSort: TopologicalSort,
    private readonly httpStep: HttpStep,
    private readonly delayStep: DelayStep,
    private readonly conditionStep: ConditionStep,
    private readonly scriptStep: ScriptStep,
    private readonly executionEventsService: ExecutionEventsService,
  ) {}

  async executeWorkflow(
    workflowId: string,
    user: any,
    options: ExecuteWorkflowOptions = {},
  ) {
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        tenantId: user.tenantId,
      },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
    });

    if (!workflow || workflow.versions.length === 0) {
      throw new NotFoundException('Workflow or latest version not found');
    }

    const latestVersion = workflow.versions[0];
    const definition =
      latestVersion.definitionJson as unknown as WorkflowDefinition;

    this.dagValidator.validate(definition);
    this.cycleDetector.detect(definition);
    const sortedNodes = this.topologicalSort.sort(definition);
    const timeoutMs = definition.timeout_ms;
    const deadlineAt = Date.now() + timeoutMs;

    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: latestVersion.id,
        tenantId: user.tenantId,
        triggerType: options.triggerType ?? 'MANUAL',
        status: RunStatus.RUNNING,
        startedAt: new Date(),
        inputPayload: options.inputPayload as any,
        createdById: user.sub,
      },
    });

    this.executionEventsService.emit({
      tenantId: user.tenantId,
      runId: run.id,
      type: 'run.started',
      data: {
        workflowId: workflow.id,
        workflowVersionId: latestVersion.id,
        triggerType: options.triggerType ?? 'MANUAL',
        status: RunStatus.RUNNING,
      },
    });

    try {
      await this.executeNodesByDependency(
        run.id,
        user.tenantId,
        definition,
        sortedNodes,
        deadlineAt,
      );

      const finishedAt = new Date();

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: RunStatus.SUCCEEDED,
          finishedAt,
          durationMs: finishedAt.getTime() - run.startedAt!.getTime(),
        },
      });

      this.executionEventsService.emit({
        tenantId: user.tenantId,
        runId: run.id,
        type: 'run.succeeded',
        data: {
          status: RunStatus.SUCCEEDED,
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - run.startedAt!.getTime(),
        },
      });
    } catch (error: any) {
      const finishedAt = new Date();
      const status =
        error instanceof WorkflowTimeoutError
          ? RunStatus.TIMEOUT
          : RunStatus.FAILED;

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status,
          finishedAt,
          durationMs: finishedAt.getTime() - run.startedAt!.getTime(),
          errorMessage: error.message,
        },
      });

      this.executionEventsService.emit({
        tenantId: user.tenantId,
        runId: run.id,
        type: status === RunStatus.TIMEOUT ? 'run.timeout' : 'run.failed',
        data: {
          status,
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - run.startedAt!.getTime(),
          errorMessage: error.message,
        },
      });

      throw error;
    }

    const result = await this.prisma.workflowRun.findUnique({
      where: { id: run.id },
      include: {
        steps: true,
        logs: true,
      },
    });

    return serializeBigInt(result);
  }

  async executeWebhookWorkflow(
    tenantSlug: string,
    workflowId: string,
    inputPayload: Record<string, any>,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.executeWorkflow(
      workflowId,
      {
        tenantId: tenant.id,
        sub: undefined,
      },
      {
        triggerType: 'WEBHOOK',
        inputPayload,
      },
    );
  }

  private async executeNodesByDependency(
    runId: string,
    tenantId: string,
    definition: WorkflowDefinition,
    sortedNodes: WorkflowNode[],
    deadlineAt: number,
  ) {
    const nodesById = new Map(sortedNodes.map((node) => [node.id, node]));
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    const edgesByKey = new Map(
      definition.edges.map((edge) => [`${edge.from}->${edge.to}`, edge]),
    );
    const skipped = new Set<string>();
    const blockedEdges = new Set<string>();
    const outputs = new Map<string, Record<string, any>>();

    for (const node of sortedNodes) {
      inDegree.set(node.id, 0);
      dependents.set(node.id, []);
      incoming.set(node.id, []);
    }

    for (const edge of definition.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      dependents.get(edge.from)?.push(edge.to);
      incoming.get(edge.to)?.push(edge.from);
    }

    const ready = sortedNodes
      .filter((node) => inDegree.get(node.id) === 0)
      .map((node) => node.id);
    let completedCount = 0;

    while (ready.length > 0) {
      this.assertWithinDeadline(deadlineAt, definition.timeout_ms);

      const currentLayerIds = ready.splice(0, ready.length);
      const completedLayer = await Promise.all(
        currentLayerIds.map(async (nodeId) => {
          const node = nodesById.get(nodeId)!;

          const result = await this.executeNode(
            runId,
            tenantId,
            node,
            deadlineAt,
            definition.timeout_ms,
          );
          outputs.set(nodeId, result.output);

          return nodeId;
        }),
      );

      for (const nodeId of completedLayer) {
        completedCount += 1;

        for (const dependentId of dependents.get(nodeId) ?? []) {
          const edgeKey = `${nodeId}->${dependentId}`;
          const edge = edgesByKey.get(edgeKey);

          if (
            edge?.condition !== undefined &&
            Boolean(outputs.get(nodeId)?.result) !== edge.condition
          ) {
            blockedEdges.add(edgeKey);

            if (
              this.shouldSkipNode(dependentId, incoming, skipped, blockedEdges)
            ) {
              await this.skipNodeAndDependents(
                dependentId,
                runId,
                tenantId,
                nodesById,
                incoming,
                dependents,
                skipped,
                blockedEdges,
              );
            }

            continue;
          }

          inDegree.set(dependentId, (inDegree.get(dependentId) ?? 0) - 1);

          if (inDegree.get(dependentId) === 0) {
            ready.push(dependentId);
          }
        }
      }
    }

    if (completedCount + skipped.size !== sortedNodes.length) {
      throw new Error('Workflow execution stopped before all nodes completed');
    }
  }

  private shouldSkipNode(
    nodeId: string,
    incoming: Map<string, string[]>,
    skipped: Set<string>,
    blockedEdges: Set<string>,
  ) {
    const incomingSources = incoming.get(nodeId) ?? [];

    return incomingSources.every(
      (sourceId) =>
        skipped.has(sourceId) || blockedEdges.has(`${sourceId}->${nodeId}`),
    );
  }

  private async skipNodeAndDependents(
    nodeId: string,
    runId: string,
    tenantId: string,
    nodesById: Map<string, WorkflowNode>,
    incoming: Map<string, string[]>,
    dependents: Map<string, string[]>,
    skipped: Set<string>,
    blockedEdges: Set<string>,
  ) {
    if (skipped.has(nodeId)) return;

    const node = nodesById.get(nodeId);
    if (!node) return;

    skipped.add(nodeId);

    const stepRecord = await this.prisma.workflowRunStep.create({
      data: {
        workflowRunId: runId,
        tenantId,
        stepId: node.id,
        stepType: node.type,
        status: StepStatus.SKIPPED,
        attemptNo: 0,
      },
    });

    this.executionEventsService.emit({
      tenantId,
      runId,
      type: 'step.skipped',
      data: {
        stepRecordId: stepRecord.id,
        stepId: node.id,
        stepType: node.type,
        status: StepStatus.SKIPPED,
      },
    });

    await this.prisma.executionLog.create({
      data: {
        tenantId,
        workflowRunId: runId,
        workflowRunStepId: stepRecord.id,
        level: 'INFO',
        message: `Step ${node.name} skipped by conditional branch`,
      },
    });

    for (const dependentId of dependents.get(nodeId) ?? []) {
      blockedEdges.add(`${nodeId}->${dependentId}`);

      if (this.shouldSkipNode(dependentId, incoming, skipped, blockedEdges)) {
        await this.skipNodeAndDependents(
          dependentId,
          runId,
          tenantId,
          nodesById,
          incoming,
          dependents,
          skipped,
          blockedEdges,
        );
      }
    }
  }

  private async executeNode(
    runId: string,
    tenantId: string,
    node: WorkflowNode,
    deadlineAt: number,
    workflowTimeoutMs: number,
  ): Promise<NodeExecutionResult> {
    const stepRecord = await this.prisma.workflowRunStep.create({
      data: {
        workflowRunId: runId,
        tenantId,
        stepId: node.id,
        stepType: node.type,
        status: StepStatus.RUNNING,
        attemptNo: 0,
        startedAt: new Date(),
        inputPayload: node.config as any,
      },
    });

    this.executionEventsService.emit({
      tenantId,
      runId,
      type: 'step.running',
      data: {
        stepRecordId: stepRecord.id,
        stepId: node.id,
        stepType: node.type,
        status: StepStatus.RUNNING,
      },
    });

    const maxAttempts = this.resolveMaxAttempts(node.retry);

    try {
      const result = await this.executeNodeWithRetry(
        runId,
        tenantId,
        stepRecord.id,
        node,
        maxAttempts,
        deadlineAt,
        workflowTimeoutMs,
      );

      const finishedAt = new Date();

      await this.prisma.workflowRunStep.update({
        where: { id: stepRecord.id },
        data: {
          status: StepStatus.SUCCEEDED,
          attemptNo: result.attemptNo,
          finishedAt,
          durationMs: finishedAt.getTime() - stepRecord.startedAt!.getTime(),
          outputPayload: result.output,
        },
      });

      this.executionEventsService.emit({
        tenantId,
        runId,
        type: 'step.succeeded',
        data: {
          stepRecordId: stepRecord.id,
          stepId: node.id,
          stepType: node.type,
          status: StepStatus.SUCCEEDED,
          attemptNo: result.attemptNo,
          durationMs: finishedAt.getTime() - stepRecord.startedAt!.getTime(),
        },
      });

      await this.prisma.executionLog.create({
        data: {
          tenantId,
          workflowRunId: runId,
          workflowRunStepId: stepRecord.id,
          level: 'INFO',
          message: `Step ${node.name} succeeded`,
          meta: result.output,
        },
      });

      return { output: result.output };
    } catch (error: any) {
      const finishedAt = new Date();

      await this.prisma.workflowRunStep.update({
        where: { id: stepRecord.id },
        data: {
          status: StepStatus.FAILED,
          finishedAt,
          durationMs: finishedAt.getTime() - stepRecord.startedAt!.getTime(),
          errorMessage: error.message,
        },
      });

      this.executionEventsService.emit({
        tenantId,
        runId,
        type: 'step.failed',
        data: {
          stepRecordId: stepRecord.id,
          stepId: node.id,
          stepType: node.type,
          status: StepStatus.FAILED,
          durationMs: finishedAt.getTime() - stepRecord.startedAt!.getTime(),
          errorMessage: error.message,
        },
      });

      await this.prisma.executionLog.create({
        data: {
          tenantId,
          workflowRunId: runId,
          workflowRunStepId: stepRecord.id,
          level: 'ERROR',
          message: `Step ${node.name} failed`,
          meta: { error: error.message } as any,
        },
      });

      throw error;
    }
  }

  private async executeNodeWithRetry(
    runId: string,
    tenantId: string,
    stepRecordId: string,
    node: WorkflowNode,
    maxAttempts: number,
    deadlineAt: number,
    workflowTimeoutMs: number,
  ) {
    let lastError: any;

    for (let attemptNo = 1; attemptNo <= maxAttempts; attemptNo += 1) {
      this.assertWithinDeadline(deadlineAt, workflowTimeoutMs);

      await this.prisma.workflowRunStep.update({
        where: { id: stepRecordId },
        data: { attemptNo },
      });

      try {
        const output = await this.withRemainingTimeout(
          this.executeStep(node),
          deadlineAt,
          workflowTimeoutMs,
        );

        return { output, attemptNo };
      } catch (error: any) {
        lastError = error;

        if (
          error instanceof WorkflowTimeoutError ||
          attemptNo === maxAttempts
        ) {
          break;
        }

        const backoffMs = this.resolveBackoffMs(node.retry, attemptNo);

        await this.prisma.executionLog.create({
          data: {
            tenantId,
            workflowRunId: runId,
            workflowRunStepId: stepRecordId,
            level: 'WARN',
            message: `Step ${node.name} failed on attempt ${attemptNo}; retrying in ${backoffMs}ms`,
            meta: { error: error.message, attemptNo, backoffMs } as any,
          },
        });

        this.executionEventsService.emit({
          tenantId,
          runId,
          type: 'step.retrying',
          data: {
            stepRecordId,
            stepId: node.id,
            stepType: node.type,
            attemptNo,
            backoffMs,
            errorMessage: error.message,
          },
        });

        await this.withRemainingTimeout(
          this.sleep(backoffMs),
          deadlineAt,
          workflowTimeoutMs,
        );
      }
    }

    throw lastError;
  }

  private executeStep(node: WorkflowNode) {
    switch (node.type) {
      case 'http':
        return this.httpStep.execute(node.config);
      case 'delay':
        return this.delayStep.execute(node.config);
      case 'condition':
        return this.conditionStep.execute(node.config);
      case 'script':
        return this.scriptStep.execute(node.config);
      default:
        throw new Error(
          `Unsupported step type: ${(node as { type: string }).type}`,
        );
    }
  }

  private resolveMaxAttempts(retry?: RetryConfig) {
    return Math.max(1, retry?.max_attempts ?? 1);
  }

  private resolveBackoffMs(retry: RetryConfig | undefined, attemptNo: number) {
    const baseBackoffMs = Math.max(0, retry?.backoff_ms ?? 0);

    return baseBackoffMs * 2 ** (attemptNo - 1);
  }

  private assertWithinDeadline(deadlineAt: number, workflowTimeoutMs: number) {
    if (Date.now() >= deadlineAt) {
      throw new WorkflowTimeoutError(workflowTimeoutMs);
    }
  }

  private async withRemainingTimeout<T>(
    promise: Promise<T>,
    deadlineAt: number,
    workflowTimeoutMs: number,
  ) {
    const remainingMs = deadlineAt - Date.now();

    if (remainingMs <= 0) {
      throw new WorkflowTimeoutError(workflowTimeoutMs);
    }

    return Promise.race([
      promise,
      this.sleep(remainingMs).then(() => {
        throw new WorkflowTimeoutError(workflowTimeoutMs);
      }),
    ]);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
