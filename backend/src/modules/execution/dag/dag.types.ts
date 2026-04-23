export type StepType = 'http' | 'delay' | 'condition' | 'script';

export interface RetryConfig {
  max_attempts: number;
  backoff_ms: number;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: StepType;
  config: Record<string, any>;
  retry?: RetryConfig;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: boolean;
}

export interface WorkflowDefinition {
  name: string;
  timeout_ms: number;
  schedule?: {
    cron: string;
  };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
