import {
  Body,
  Controller,
  Headers,
  MessageEvent,
  Param,
  Post,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
    @Headers('x-flowforge-signature') signature?: string,
  ) {
    this.verifyWebhookSignature(payload, signature);

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

  private verifyWebhookSignature(
    payload: Record<string, any>,
    signature?: string,
  ) {
    const secret = process.env.WEBHOOK_SECRET;

    if (!secret) return;

    const expected = createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    const normalizedSignature = signature?.replace(/^sha256=/, '') ?? '';
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(normalizedSignature, 'hex');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
