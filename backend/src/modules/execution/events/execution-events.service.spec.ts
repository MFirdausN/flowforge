import { firstValueFrom, skip, take } from 'rxjs';
import { ExecutionEventsService } from './execution-events.service';

describe('ExecutionEventsService', () => {
  it('streams only events for the requested tenant and run', async () => {
    const service = new ExecutionEventsService();
    const eventPromise = firstValueFrom(
      service.stream('tenant-1', 'run-1').pipe(skip(1), take(1)),
    );

    service.emit({
      tenantId: 'tenant-2',
      runId: 'run-1',
      type: 'run.started',
      data: { ignored: true },
    });
    service.emit({
      tenantId: 'tenant-1',
      runId: 'run-2',
      type: 'run.started',
      data: { ignored: true },
    });
    service.emit({
      tenantId: 'tenant-1',
      runId: 'run-1',
      type: 'step.running',
      data: { stepId: 'fetch' },
    });

    await expect(eventPromise).resolves.toEqual(
      expect.objectContaining({
        type: 'step.running',
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          runId: 'run-1',
        }),
      }),
    );
  });
});
