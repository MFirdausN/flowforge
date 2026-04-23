"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  tenant: {
    slug: string;
  };
};

type WorkflowDefinition = {
  name: string;
  timeout_ms: number;
  schedule?: {
    cron: string;
  };
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
  }>;
};

type Workflow = {
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
  _count?: {
    versions: number;
    runs: number;
  };
};

type WorkflowRun = {
  id: string;
  workflowId: string;
  triggerType: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  workflow?: {
    name: string;
  };
};

type RunDetail = WorkflowRun & {
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
    logs?: Array<ExecutionLog>;
  }>;
  logs: Array<ExecutionLog>;
};

type ExecutionLog = {
  id: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  createdAt: string;
};

type HealthOverview = {
  activeRuns: number;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  successRate: number;
  averageDurationMs: number;
};

type FailureAnalysis = {
  source: "heuristic" | "llm";
  summary: string;
  likelyCause: string;
  suggestedFix: string;
  confidence: "low" | "medium" | "high";
};

export default function Home() {
  const [email, setEmail] = useState("admin@tenant1.local");
  const [password, setPassword] = useState("password123");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null,
  );
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [failureAnalysis, setFailureAnalysis] =
    useState<FailureAnalysis | null>(null);
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedToken = localStorage.getItem("flowforge_token");
      const savedUser = localStorage.getItem("flowforge_user");

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  async function apiFetch<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Request failed with ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  const refreshDashboard = useCallback(
    async (activeToken = token) => {
      if (!activeToken) {
        return;
      }

      setIsLoading(true);
      setMessage("");

      try {
        const [workflowResponse, runResponse, healthResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/workflows?page=1&limit=20`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }).then((response) => response.json()),
          fetch(`${API_BASE_URL}/runs?page=1&limit=20`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }).then((response) => response.json()),
          fetch(`${API_BASE_URL}/health/overview`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }).then((response) => response.json()),
        ]);

        setWorkflows(workflowResponse.data ?? []);
        setRuns(runResponse.data ?? []);
        setOverview(healthResponse);
        setSelectedWorkflow((current) => current ?? workflowResponse.data?.[0]);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to load data",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const refreshTimer = window.setTimeout(() => {
      void refreshDashboard(token);
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [refreshDashboard, token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed. Check email and password.");
      }

      const data = (await response.json()) as {
        access_token: string;
        user: ApiUser;
      };

      localStorage.setItem("flowforge_token", data.access_token);
      localStorage.setItem("flowforge_user", JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setMessage("Login successful. Dashboard synced.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTrigger(workflowId: string) {
    setMessage("");

    try {
      await apiFetch(`/execution/trigger/${workflowId}`, { method: "POST" });
      setMessage("Workflow triggered. Refreshing run history.");
      await refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trigger failed");
    }
  }

  async function handleRunSelect(run: WorkflowRun) {
    setSelectedRun(null);
    setFailureAnalysis(null);
    setMessage("");

    try {
      const detail = await apiFetch<RunDetail>(`/runs/${run.id}`);
      setSelectedRun(detail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load run");
    }
  }

  async function handleFailureAnalysis(runId: string) {
    setMessage("");
    setFailureAnalysis(null);

    try {
      const analysis = await apiFetch<FailureAnalysis>(
        `/ai/runs/${runId}/failure-analysis`,
      );
      setFailureAnalysis(analysis);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to analyze run",
      );
    }
  }

  function logout() {
    localStorage.removeItem("flowforge_token");
    localStorage.removeItem("flowforge_user");
    setToken(null);
    setUser(null);
    setWorkflows([]);
    setRuns([]);
    setSelectedWorkflow(null);
    setSelectedRun(null);
    setFailureAnalysis(null);
  }

  if (!token || !user) {
    return (
      <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#d6f4ef,transparent_32%),linear-gradient(135deg,#f8f1df_0%,#e5f0ec_45%,#20313a_100%)] px-6 py-10 text-slate-950">
        <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <p className="w-fit rounded-full border border-slate-900/15 bg-white/45 px-4 py-2 text-sm font-semibold tracking-[0.28em] text-slate-700">
              FLOWFORGE MVP
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-slate-950 md:text-7xl">
              Multi-tenant workflow command center.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-700">
              Login sebagai admin/editor/viewer, pantau workflow, run history,
              logs, dan visual DAG dari backend FlowForge lokal.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="rounded-[2rem] border border-white/55 bg-white/70 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur-xl"
          >
            <div className="mb-6">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-teal-800">
                Secure Login
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                Masuk Dashboard
              </h2>
            </div>

            <label className="block text-sm font-bold text-slate-700">
              Email
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-teal-600 transition focus:ring-4"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="mt-4 block text-sm font-bold text-slate-700">
              Password
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-teal-600 transition focus:ring-4"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <button
              className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:-translate-y-0.5 hover:bg-teal-900 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Login"}
            </button>

            {message && <p className="mt-4 text-sm text-slate-700">{message}</p>}
          </form>
        </section>
      </main>
    );
  }

  const selectedDefinition =
    selectedRun?.workflowVersion?.definitionJson ??
    selectedWorkflow?.versions?.[0]?.definitionJson;

  return (
    <main className="min-h-screen bg-[#f3efe2] text-slate-950">
      <header className="border-b border-slate-950/10 bg-[#f9f4e7]/90 px-5 py-5 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-teal-800">
              FlowForge Dashboard
            </p>
            <h1 className="text-3xl font-black tracking-[-0.05em] md:text-5xl">
              Workflow operations
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">
              {user.name} · {user.role}
            </span>
            <button
              className="rounded-full border border-slate-950/20 px-4 py-2 text-sm font-black transition hover:bg-white"
              onClick={() => void refreshDashboard()}
            >
              Refresh
            </button>
            <button
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 md:px-8 xl:grid-cols-[0.95fr_1.15fr_0.9fr]">
        <div className="space-y-5">
          <MetricStrip overview={overview} />
          <Panel title="Workflows" eyebrow={`${workflows.length} loaded`}>
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  className={`w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${
                    selectedWorkflow?.id === workflow.id
                      ? "border-teal-700 bg-teal-50 shadow-lg shadow-teal-900/10"
                      : "border-slate-950/10 bg-white/75"
                  }`}
                  onClick={() => setSelectedWorkflow(workflow)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black tracking-[-0.03em]">
                        {workflow.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        v{workflow.currentVersionNo} ·{" "}
                        {workflow._count?.runs ?? 0} runs
                      </p>
                    </div>
                    <StatusBadge status={workflow.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                    {workflow.description || "No description provided."}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={user.role === "VIEWER"}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleTrigger(workflow.id);
                      }}
                    >
                      Trigger
                    </button>
                    <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                      {workflow.versions?.[0]?.definitionJson?.nodes?.length ?? 0}{" "}
                      steps
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title="DAG Visual"
            eyebrow={selectedDefinition?.name ?? "Select workflow or run"}
          >
            <DagVisual definition={selectedDefinition} />
          </Panel>

          <Panel title="Run Detail" eyebrow={selectedRun?.id ?? "Pick a run"}>
            {selectedRun ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoTile label="Status" value={selectedRun.status} />
                  <InfoTile label="Trigger" value={selectedRun.triggerType} />
                  <InfoTile
                    label="Duration"
                    value={`${selectedRun.durationMs ?? 0}ms`}
                  />
                </div>
                <button
                  className="rounded-full bg-teal-800 px-4 py-2 text-sm font-black text-white transition hover:bg-teal-950"
                  onClick={() => void handleFailureAnalysis(selectedRun.id)}
                >
                  Analyze Failure
                </button>
                {failureAnalysis && (
                  <div className="rounded-3xl border border-teal-900/15 bg-teal-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-black tracking-[-0.03em]">
                        AI Failure Analysis
                      </h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-teal-900">
                        {failureAnalysis.source} · {failureAnalysis.confidence}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-700">
                      {failureAnalysis.summary}
                    </p>
                    <p className="mt-3 text-sm text-slate-700">
                      <strong>Likely cause:</strong>{" "}
                      {failureAnalysis.likelyCause}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      <strong>Suggested fix:</strong>{" "}
                      {failureAnalysis.suggestedFix}
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  {selectedRun.steps.map((step) => (
                    <div
                      key={step.id}
                      className="rounded-2xl border border-slate-950/10 bg-white/80 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <strong>{step.stepId}</strong>
                        <StatusBadge status={step.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {step.stepType} · attempt {step.attemptNo} ·{" "}
                        {step.durationMs ?? 0}ms
                      </p>
                      {step.errorMessage && (
                        <p className="mt-2 text-sm font-bold text-red-700">
                          {step.errorMessage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState text="Pilih salah satu run untuk melihat step tracking dan logs." />
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Run History" eyebrow={`${runs.length} latest`}>
            <div className="space-y-3">
              {runs.map((run) => (
                <button
                  key={run.id}
                  className={`w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${
                    selectedRun?.id === run.id
                      ? "border-amber-700 bg-amber-50"
                      : "border-slate-950/10 bg-white/75"
                  }`}
                  onClick={() => void handleRunSelect(run)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">
                        {run.workflow?.name ?? run.workflowId}
                      </h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        {run.triggerType}
                      </p>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {formatDate(run.startedAt)} · {run.durationMs ?? 0}ms
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          {message && (
            <div className="rounded-3xl border border-slate-950/10 bg-slate-950 p-4 text-sm font-bold text-white">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function MetricStrip({ overview }: { overview: HealthOverview | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <InfoTile label="Active" value={overview?.activeRuns ?? 0} />
      <InfoTile label="Runs 24h" value={overview?.totalRuns ?? 0} />
      <InfoTile
        label="Success"
        value={`${Math.round((overview?.successRate ?? 0) * 100)}%`}
      />
      <InfoTile label="Avg" value={`${overview?.averageDurationMs ?? 0}ms`} />
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-950/10 bg-[#fffaf0]/85 p-5 shadow-xl shadow-slate-950/5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-800">
            {eyebrow}
          </p>
          <h2 className="text-2xl font-black tracking-[-0.05em]">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-950/10 bg-white/80 p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "SUCCEEDED" || status === "ACTIVE"
      ? "bg-teal-100 text-teal-900"
      : status === "FAILED" || status === "TIMEOUT"
        ? "bg-red-100 text-red-900"
        : status === "RUNNING"
          ? "bg-amber-100 text-amber-900"
          : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${color}`}>
      {status}
    </span>
  );
}

function DagVisual({
  definition,
}: {
  definition: WorkflowDefinition | undefined;
}) {
  if (!definition) {
    return <EmptyState text="Belum ada workflow definition untuk divisualkan." />;
  }

  const width = 760;
  const height = Math.max(260, definition.nodes.length * 92);
  const positions = new Map(
    definition.nodes.map((node, index) => [
      node.id,
      {
        x: 90 + (index % 2) * 330,
        y: 60 + index * 82,
      },
    ]),
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-950/10 bg-[#172033]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[420px] w-full md:h-[520px]"
        role="img"
      >
        <defs>
          <marker
            id="arrow"
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="8"
            refY="4"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#eab308" />
          </marker>
        </defs>
        {definition.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);

          if (!from || !to) {
            return null;
          }

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              markerEnd="url(#arrow)"
              stroke="#eab308"
              strokeDasharray="8 8"
              strokeWidth="3"
              x1={from.x + 210}
              x2={to.x}
              y1={from.y + 34}
              y2={to.y + 34}
            />
          );
        })}
        {definition.nodes.map((node) => {
          const position = positions.get(node.id)!;

          return (
            <g key={node.id}>
              <rect
                fill="#fef7e6"
                height="68"
                rx="22"
                stroke="#2dd4bf"
                strokeWidth="3"
                width="230"
                x={position.x}
                y={position.y}
              />
              <text
                fill="#172033"
                fontSize="17"
                fontWeight="900"
                x={position.x + 20}
                y={position.y + 30}
              >
                {node.name.slice(0, 20)}
              </text>
              <text
                fill="#0f766e"
                fontSize="13"
                fontWeight="800"
                x={position.x + 20}
                y={position.y + 52}
              >
                {node.id} · {node.type}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-950/20 bg-white/55 p-8 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "not started";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
