import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { serializeBigInt } from '../../common/utils/serialize-bigint';
import { ListRunsQueryDto } from './dto/list-runs-query.dto';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListRunsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.WorkflowRunWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.workflowId ? { workflowId: query.workflowId } : {}),
    };

    const [total, runs] = await Promise.all([
      this.prisma.workflowRun.count({ where }),
      this.prisma.workflowRun.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          workflowVersion: {
            select: {
              id: true,
              versionNo: true,
            },
          },
          _count: {
            select: {
              steps: true,
              logs: true,
            },
          },
        },
      }),
    ]);

    return serializeBigInt({
      data: runs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const run = await this.prisma.workflowRun.findFirst({
      where: { id, tenantId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        workflowVersion: {
          select: {
            id: true,
            versionNo: true,
            definitionJson: true,
          },
        },
        steps: {
          orderBy: { createdAt: 'asc' },
          include: {
            logs: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    return serializeBigInt(run);
  }
}
