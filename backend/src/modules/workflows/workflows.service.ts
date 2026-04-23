import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkflowStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CycleDetector } from '../execution/dag/cycle-detector';
import { DagValidator } from '../execution/dag/dag.validator';
import { WorkflowDefinition } from '../execution/dag/dag.types';
import { TopologicalSort } from '../execution/dag/topological-sort';
import { CronMatcher } from '../execution/scheduler/cron-matcher';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { ListWorkflowsQueryDto } from './dto/list-workflows-query.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dagValidator: DagValidator,
    private readonly cycleDetector: CycleDetector,
    private readonly topologicalSort: TopologicalSort,
    private readonly cronMatcher: CronMatcher,
  ) {}

  async findAll(tenantId: string, query: ListWorkflowsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.WorkflowWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, workflows] = await Promise.all([
      this.prisma.workflow.count({ where }),
      this.prisma.workflow.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          versions: {
            orderBy: { versionNo: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              versions: true,
              runs: true,
            },
          },
        },
      }),
    ]);

    return {
      data: workflows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private validateDefinition(definition: WorkflowDefinition) {
    this.dagValidator.validate(definition);
    this.cycleDetector.detect(definition);
    this.topologicalSort.sort(definition);

    if (
      definition.schedule &&
      !this.cronMatcher.isValid(definition.schedule.cron)
    ) {
      throw new BadRequestException('Schedule cron expression is invalid');
    }
  }

  async findOne(id: string, tenantId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async findVersions(id: string, tenantId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return this.prisma.workflowVersion.findMany({
      where: {
        workflowId: id,
        tenantId,
      },
      orderBy: {
        versionNo: 'desc',
      },
    });
  }

  async create(dto: CreateWorkflowDto, user: any) {
    const status = (dto.status as WorkflowStatus) || WorkflowStatus.DRAFT;
    this.validateDefinition(dto.definition as WorkflowDefinition);

    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          description: dto.description,
          status,
          currentVersionNo: 1,
          createdById: user.sub,
          updatedById: user.sub,
        },
      });

      await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          tenantId: user.tenantId,
          versionNo: 1,
          definitionJson: dto.definition as any,
          createdById: user.sub,
        },
      });

      return workflow;
    });
  }

  async update(id: string, dto: UpdateWorkflowDto, user: any) {
    if (dto.definition) {
      this.validateDefinition(dto.definition as WorkflowDefinition);
    }

    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Workflow not found');
    }

    return this.prisma.$transaction(async (tx) => {
      let nextVersionNo = existing.currentVersionNo;

      if (dto.definition) {
        nextVersionNo += 1;

        await tx.workflowVersion.create({
          data: {
            workflowId: existing.id,
            tenantId: user.tenantId,
            versionNo: nextVersionNo,
            definitionJson: dto.definition as any,
            createdById: user.sub,
          },
        });
      }

      const updated = await tx.workflow.update({
        where: { id: existing.id },
        data: {
          name: dto.name ?? existing.name,
          description: dto.description ?? existing.description,
          status: (dto.status as WorkflowStatus) ?? existing.status,
          currentVersionNo: nextVersionNo,
          updatedById: user.sub,
        },
      });

      return updated;
    });
  }

  async rollback(id: string, versionNo: number, user: any) {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Workflow not found');
    }

    const targetVersion = await this.prisma.workflowVersion.findFirst({
      where: {
        workflowId: id,
        tenantId: user.tenantId,
        versionNo,
      },
    });

    if (!targetVersion) {
      throw new NotFoundException('Workflow version not found');
    }

    this.validateDefinition(
      targetVersion.definitionJson as unknown as WorkflowDefinition,
    );

    return this.prisma.$transaction(async (tx) => {
      const nextVersionNo = existing.currentVersionNo + 1;

      await tx.workflowVersion.create({
        data: {
          workflowId: existing.id,
          tenantId: user.tenantId,
          versionNo: nextVersionNo,
          definitionJson: targetVersion.definitionJson as any,
          checksum: targetVersion.checksum,
          createdById: user.sub,
        },
      });

      return tx.workflow.update({
        where: { id: existing.id },
        data: {
          currentVersionNo: nextVersionNo,
          updatedById: user.sub,
        },
      });
    });
  }

  async remove(id: string, user: any) {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Workflow not found');
    }

    await this.prisma.workflow.delete({
      where: { id: existing.id },
    });

    return { deleted: true, id: existing.id };
  }
}
