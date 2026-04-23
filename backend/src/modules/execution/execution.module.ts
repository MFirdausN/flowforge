import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { DagValidator } from './dag/dag.validator';
import { CycleDetector } from './dag/cycle-detector';
import { TopologicalSort } from './dag/topological-sort';
import { WorkflowExecutor } from './engine/workflow.executor';
import { HttpStep } from './steps/http.step';
import { DelayStep } from './steps/delay.step';
import { ConditionStep } from './steps/condition.step';
import { ScriptStep } from './steps/script.step';
import { CronMatcher } from './scheduler/cron-matcher';
import { WorkflowSchedulerService } from './scheduler/workflow-scheduler.service';
import { ExecutionEventsService } from './events/execution-events.service';

@Module({
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    DagValidator,
    CycleDetector,
    TopologicalSort,
    WorkflowExecutor,
    WorkflowSchedulerService,
    ExecutionEventsService,
    CronMatcher,
    HttpStep,
    DelayStep,
    ConditionStep,
    ScriptStep,
  ],
  exports: [
    WorkflowExecutor,
    DagValidator,
    CycleDetector,
    TopologicalSort,
    CronMatcher,
    ExecutionEventsService,
  ],
})
export class ExecutionModule {}
