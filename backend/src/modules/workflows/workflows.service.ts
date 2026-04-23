import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(tenantId: string) {
    return this.prisma.workflow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
    });
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

  async create(dto: CreateWorkflowDto, user: any) {
    const status = (dto.status as WorkflowStatus) || WorkflowStatus.DRAFT;

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
}