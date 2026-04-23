import { Injectable } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getTenantOverview(tenantId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const scopedToLast24Hours = {
      tenantId,
      createdAt: {
        gte: since,
      },
    };

    const [
      activeRuns,
      totalRuns,
      succeededRuns,
      failedRuns,
      timedOutRuns,
      canceledRuns,
      durationAggregate,
    ] = await Promise.all([
      this.prisma.workflowRun.count({
        where: {
          tenantId,
          status: {
            in: [RunStatus.PENDING, RunStatus.RUNNING],
          },
        },
      }),
      this.prisma.workflowRun.count({
        where: scopedToLast24Hours,
      }),
      this.prisma.workflowRun.count({
        where: {
          ...scopedToLast24Hours,
          status: RunStatus.SUCCEEDED,
        },
      }),
      this.prisma.workflowRun.count({
        where: {
          ...scopedToLast24Hours,
          status: RunStatus.FAILED,
        },
      }),
      this.prisma.workflowRun.count({
        where: {
          ...scopedToLast24Hours,
          status: RunStatus.TIMEOUT,
        },
      }),
      this.prisma.workflowRun.count({
        where: {
          ...scopedToLast24Hours,
          status: RunStatus.CANCELED,
        },
      }),
      this.prisma.workflowRun.aggregate({
        where: scopedToLast24Hours,
        _avg: {
          durationMs: true,
        },
      }),
    ]);

    const unsuccessfulRuns = failedRuns + timedOutRuns + canceledRuns;

    return {
      window: {
        from: since.toISOString(),
        to: new Date().toISOString(),
      },
      activeRuns,
      totalRuns,
      succeededRuns,
      failedRuns: unsuccessfulRuns,
      successRate: totalRuns === 0 ? 0 : succeededRuns / totalRuns,
      failureRate: totalRuns === 0 ? 0 : unsuccessfulRuns / totalRuns,
      averageDurationMs: Math.round(durationAggregate._avg.durationMs ?? 0),
      breakdown: {
        failed: failedRuns,
        timedOut: timedOutRuns,
        canceled: canceledRuns,
      },
    };
  }
}
