export type ViewKey = "home" | "posts" | "review" | "users" | "tools";
export type UserRole = "ADMIN" | "EDITOR" | "USER";
export type LiveStatus = "idle" | "connecting" | "connected" | "closed";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  tenant: { slug: string };
};

export type BlogPostStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  status: BlogPostStatus;
  publishedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; role: UserRole };
  reviewer?: { id: string; name: string; role: UserRole } | null;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type WorkflowDefinition = {
  name: string;
  timeout_ms: number;
  schedule?: { cron: string };
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
  }>;
  edges: Array<{ from: string; to: string; condition?: boolean }>;
};

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  currentVersionNo: number;
  versions: Array<{
    id: string;
    versionNo: number;
    definitionJson: WorkflowDefinition;
  }>;
  _count?: { versions: number; runs: number };
};

export type WorkflowListResponse = {
  data: Workflow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  triggerType: string;
  status: string;
  startedAt?: string;
  durationMs?: number;
  workflow?: { name: string };
};

export type RunDetail = WorkflowRun & {
  workflowVersion?: {
    versionNo: number;
    definitionJson: WorkflowDefinition;
  };
  steps: Array<{
    id: string;
    stepId: string;
    stepType: string;
    status: string;
    attemptNo: number;
    durationMs?: number;
    errorMessage?: string;
  }>;
  logs: Array<{ id: string; level: string; message: string; createdAt: string }>;
};

export type HealthOverview = {
  activeRuns: number;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  successRate: number;
  averageDurationMs: number;
};

export type FailureAnalysis = {
  source: "heuristic" | "llm";
  summary: string;
  likelyCause: string;
  suggestedFix: string;
  confidence: "low" | "medium" | "high";
};

export type ExecutionSseEvent = {
  tenantId: string;
  runId: string;
  type:
    | "run.started"
    | "run.succeeded"
    | "run.failed"
    | "run.timeout"
    | "step.running"
    | "step.retrying"
    | "step.succeeded"
    | "step.failed"
    | "step.skipped";
  data: {
    stepRecordId?: string;
    stepId?: string;
    stepType?: string;
    status?: string;
    attemptNo?: number;
    durationMs?: number;
    errorMessage?: string;
  };
  emittedAt: string;
};

export type WorkflowFormState = {
  name: string;
  description: string;
  status: string;
  definition: string;
};
