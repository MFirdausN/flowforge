import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map, merge, of } from 'rxjs';

export type ExecutionEventType =
  | 'run.started'
  | 'run.succeeded'
  | 'run.failed'
  | 'run.timeout'
  | 'step.running'
  | 'step.retrying'
  | 'step.succeeded'
  | 'step.failed';

export type ExecutionEvent = {
  tenantId: string;
  runId: string;
  type: ExecutionEventType;
  data: Record<string, unknown>;
  emittedAt: string;
};

@Injectable()
export class ExecutionEventsService {
  private readonly events$ = new Subject<ExecutionEvent>();

  emit(event: Omit<ExecutionEvent, 'emittedAt'>) {
    this.events$.next({
      ...event,
      emittedAt: new Date().toISOString(),
    });
  }

  stream(tenantId: string, runId: string): Observable<MessageEvent> {
    const connectedEvent: MessageEvent = {
      type: 'connected',
      data: {
        runId,
        message: 'Connected to FlowForge execution event stream',
      },
    };

    return merge(
      of(connectedEvent),
      this.events$.pipe(
        filter((event) => event.tenantId === tenantId && event.runId === runId),
        map((event) => ({
          type: event.type,
          data: event,
        })),
      ),
    );
  }
}
