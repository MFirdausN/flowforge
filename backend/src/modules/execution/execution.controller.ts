import {
  Body,
  Controller,
  MessageEvent,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkflowExecutor } from './engine/workflow.executor';
import { ExecutionEventsService } from './events/execution-events.service';

@Controller('execution')
export class ExecutionController {
  constructor(
    private readonly workflowExecutor: WorkflowExecutor,
    private readonly executionEventsService: ExecutionEventsService,
  ) {}

  @Post('trigger/:workflowId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR)
  trigger(@Param('workflowId') workflowId: string, @CurrentUser() user: any) {
    return this.workflowExecutor.executeWorkflow(workflowId, user);
  }

  @Post('webhook/:tenantSlug/:workflowId')
  webhook(
    @Param('tenantSlug') tenantSlug: string,
    @Param('workflowId') workflowId: string,
    @Body() payload: Record<string, any>,
  ) {
    return this.workflowExecutor.executeWebhookWorkflow(
      tenantSlug,
      workflowId,
      payload,
    );
  }

  @Sse('runs/:runId/events')
  @UseGuards(JwtAuthGuard)
  streamRunEvents(
    @Param('runId') runId: string,
    @CurrentUser() user: any,
  ): Observable<MessageEvent> {
    return this.executionEventsService.stream(user.tenantId, runId);
  }
}
