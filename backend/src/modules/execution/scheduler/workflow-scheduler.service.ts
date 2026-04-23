import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WorkflowStatus } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { WorkflowDefinition } from '../dag/dag.types';
import { WorkflowExecutor } from '../engine/workflow.executor';
import { CronMatcher } from './cron-matcher';

@Injectable()
export class WorkflowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowSchedulerService.name);
  private readonly triggeredKeys = new Set<string>();
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowExecutor: WorkflowExecutor,
    private readonly cronMatcher: CronMatcher,
  ) {}

  onModuleInit() {
    this.interval = setInterval(() => void this.tick(), 60_000);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async tick(now = new Date()) {
    const minuteKey = now.toISOString().slice(0, 16);
    const workflows = await this.prisma.workflow.findMany({
      where: {
        status: WorkflowStatus.ACTIVE,
      },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
    });

    await Promise.all(
      workflows.map(async (workflow) => {
        const definition = workflow.versions[0]?.definitionJson as unknown as
          | WorkflowDefinition
          | undefined;
        const cron = definition?.schedule?.cron;

        if (!cron || !this.cronMatcher.matches(cron, now)) {
          return;
        }

        const triggerKey = `${workflow.id}:${minuteKey}`;

        if (this.triggeredKeys.has(triggerKey)) {
          return;
        }

        this.triggeredKeys.add(triggerKey);

        try {
          await this.workflowExecutor.executeWorkflow(
            workflow.id,
            {
              tenantId: workflow.tenantId,
              sub: undefined,
            },
            {
              triggerType: 'SCHEDULED',
              inputPayload: {
                cron,
                scheduledAt: now.toISOString(),
              },
            },
          );
        } catch (error: any) {
          this.logger.error(
            `Scheduled workflow ${workflow.id} failed: ${error.message}`,
          );
        }
      }),
    );

    this.pruneTriggeredKeys(minuteKey);
  }

  private pruneTriggeredKeys(currentMinuteKey: string) {
    for (const key of this.triggeredKeys) {
      if (!key.endsWith(currentMinuteKey)) {
        this.triggeredKeys.delete(key);
      }
    }
  }
}
