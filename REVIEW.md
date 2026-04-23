# Code Review Exercise

## Context

The following review is written as if responding to a teammate's pull request. The snippet is intentionally flawed and represents a workflow trigger endpoint.

## Reviewed Snippet

```ts
@Post('/trigger/:workflowId')
async trigger(@Param('workflowId') workflowId: string, @Body() body: any) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  const definition = workflow.currentDefinition;

  for (const step of definition.steps) {
    try {
      await execute(step, body);
    } catch (err) {
      console.log(err);
    }
  }

  return { ok: true };
}
```

## Review Feedback

Thanks for getting the trigger path started. The shape is easy to follow, but I would request changes before merging because this endpoint can run customer workflows and needs stronger safety guarantees.

## Findings

- **Critical: missing tenant isolation.** `findUnique({ id })` can load a workflow from another tenant if the caller guesses an id. This should always scope by `workflowId` and authenticated `tenantId`.

- **Critical: missing authentication and authorization.** Triggering a workflow should require JWT auth and should be limited to `ADMIN` or `EDITOR`. A `VIEWER` should not be able to mutate execution state.

- **High: errors are swallowed.** Catching and logging errors inside the loop means the API returns `{ ok: true }` even if a step failed. The run should be marked `FAILED`, the step error should be persisted, and the caller should receive a useful failure response.

- **High: no run or step tracking.** The code executes steps but does not create `workflow_runs`, `workflow_run_steps`, or `execution_logs`. Without those records, the dashboard cannot show status, duration, attempts, or logs.

- **High: no DAG validation or dependency handling.** The snippet assumes `definition.steps` is a flat list. The requirement is a DAG, so we need validation, cycle detection, topological sorting, and dependency-aware execution.

- **Medium: no retry or timeout behavior.** Step failures should respect configured retry and backoff. The whole workflow should also have a global timeout.

- **Medium: unsafe input shape.** `body: any` is accepted without validation. We should validate payloads and sanitize malformed definitions before execution.

- **Medium: `console.log` is not operational logging.** Use structured logs persisted to `execution_logs`, and avoid leaking sensitive payloads.

## Suggested Direction

I would split this into a controller and a dedicated executor service:

- Controller handles auth, RBAC, route params, and request payload.
- Executor loads the tenant-scoped latest workflow version.
- DAG utilities validate and sort the definition.
- Executor creates run and step records.
- Step handlers implement HTTP, delay, condition, and future script behavior.
- Errors update persisted status and are returned consistently.

This keeps the trigger endpoint thin and makes the execution engine testable with unit tests.
