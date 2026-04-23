"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

type ViewKey = "overview" | "workflows" | "runs" | "dag" | "ai" | "docs";
type UserRole = "ADMIN" | "EDITOR" | "VIEWER";

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant: { slug: string };
};

type WorkflowDefinition = {
  name: string;
  timeout_ms: number;
  schedule?: { cron: string };
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
  }>;
  edges: Array<{ from: string; to: string }>;
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
  _count?: { versions: number; runs: number };
};

type WorkflowRun = {
  id: string;
  workflowId: string;
  triggerType: string;
  status: string;
  startedAt?: string;
  durationMs?: number;
  workflow?: { name: string };
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
  }>;
  logs: Array<{ id: string; level: string; message: string; createdAt: string }>;
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

type ExecutionSseEvent = {
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
    | "step.failed";
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

const sampleDefinition = JSON.stringify(
  {
    name: "Sample HTTP workflow",
    timeout_ms: 30000,
    nodes: [
      {
        id: "fetch",
        name: "Fetch Users",
        type: "http",
        config: {
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/users",
        },
        retry: { max_attempts: 3, backoff_ms: 1000 },
      },
      {
        id: "wait",
        name: "Wait",
        type: "delay",
        config: { ms: 500 },
      },
    ],
    edges: [{ from: "fetch", to: "wait" }],
  },
  null,
  2,
);

const navItems: Array<{ key: ViewKey; label: string; hint: string }> = [
  { key: "overview", label: "Overview", hint: "System status" },
  { key: "workflows", label: "Workflows", hint: "CRUD and trigger" },
  { key: "runs", label: "Runs", hint: "History and logs" },
  { key: "dag", label: "DAG Visual", hint: "Graph preview" },
  { key: "ai", label: "AI Analysis", hint: "Failure insight" },
  { key: "docs", label: "API Docs", hint: "Backend reference" },
];

export default function Home() {
  const [email, setEmail] = useState("admin@tenant1.local");
  const [password, setPassword] = useState("password123");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null,
  );
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [failureAnalysis, setFailureAnalysis] =
    useState<FailureAnalysis | null>(null);
  const [docsSpec, setDocsSpec] = useState<Record<string, unknown> | null>(null);
  const [liveStatus, setLiveStatus] = useState<
    "idle" | "connecting" | "connected" | "closed"
  >("idle");
  const [liveEvents, setLiveEvents] = useState<ExecutionSseEvent[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [workflowForm, setWorkflowForm] = useState({
    name: "Sample HTTP workflow",
    description: "Created from admin dashboard",
    status: "DRAFT",
    definition: sampleDefinition,
  });

  const selectedDefinition = useMemo(
    () =>
      selectedRun?.workflowVersion?.definitionJson ??
      selectedWorkflow?.versions?.[0]?.definitionJson,
    [selectedRun, selectedWorkflow],
  );
  const selectedRunId = selectedRun?.id;

  const applyExecutionEvent = useCallback((event: ExecutionSseEvent) => {
    setLiveEvents((current) => [event, ...current].slice(0, 8));

    setRuns((current) =>
      current.map((run) =>
        run.id === event.runId && event.data.status
          ? {
              ...run,
              status: event.data.status,
              durationMs: event.data.durationMs ?? run.durationMs,
            }
          : run,
      ),
    );

    setSelectedRun((current) => {
      if (!current || current.id !== event.runId) return current;

      const nextRun: RunDetail = {
        ...current,
        status: event.data.status ?? current.status,
        durationMs: event.data.durationMs ?? current.durationMs,
      };

      if (!event.data.stepId) return nextRun;

      const hasStep = nextRun.steps.some(
        (step) =>
          step.stepId === event.data.stepId ||
          step.id === event.data.stepRecordId,
      );

      return {
        ...nextRun,
        steps: hasStep
          ? nextRun.steps.map((step) =>
              step.stepId === event.data.stepId ||
              step.id === event.data.stepRecordId
                ? {
                    ...step,
                    status: event.data.status ?? step.status,
                    attemptNo: event.data.attemptNo ?? step.attemptNo,
                    durationMs: event.data.durationMs ?? step.durationMs,
                    errorMessage: event.data.errorMessage ?? step.errorMessage,
                  }
                : step,
            )
          : [
              ...nextRun.steps,
              {
                id: event.data.stepRecordId ?? event.data.stepId,
                stepId: event.data.stepId,
                stepType: event.data.stepType ?? "unknown",
                status: event.data.status ?? "RUNNING",
                attemptNo: event.data.attemptNo ?? 0,
                durationMs: event.data.durationMs,
                errorMessage: event.data.errorMessage,
              },
            ],
      };
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedToken = localStorage.getItem("flowforge_token");
      const savedUser = localStorage.getItem("flowforge_user");

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    }, 0);

    return () => window.clearTimeout(timer);
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
      throw new Error((await response.text()) || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  const refreshDashboard = useCallback(
    async (activeToken = token) => {
      if (!activeToken) return;

      setIsLoading(true);
      setMessage("");

      try {
        const [workflowResponse, runResponse, healthResponse] =
          await Promise.all([
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
        setMessage(error instanceof Error ? error.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void refreshDashboard(token), 0);
    return () => window.clearTimeout(timer);
  }, [refreshDashboard, token]);

  useEffect(() => {
    if (!token || !selectedRunId) {
      return;
    }

    const controller = new AbortController();
    let buffer = "";

    async function connect() {
      setLiveStatus("connecting");

      try {
        const response = await fetch(
          `${API_BASE_URL}/execution/runs/${selectedRunId}/events`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );

        if (!response.ok || !response.body) {
          throw new Error("Realtime stream unavailable");
        }

        setLiveStatus("connected");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const dataLine = chunk
              .split("\n")
              .find((line) => line.startsWith("data:"));

            if (!dataLine) continue;

            const payload = JSON.parse(
              dataLine.replace(/^data:\s*/, ""),
            ) as ExecutionSseEvent | { message?: string };

            if ("type" in payload && "runId" in payload) {
              applyExecutionEvent(payload);
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLiveStatus("closed");
          setMessage(
            error instanceof Error
              ? error.message
              : "Realtime stream disconnected",
          );
        }
      }
    }

    void connect();

    return () => {
      controller.abort();
      setLiveStatus("closed");
    };
  }, [applyExecutionEvent, selectedRunId, token]);

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

      if (!response.ok) throw new Error("Login failed");

      const data = (await response.json()) as {
        access_token: string;
        user: ApiUser;
      };

      localStorage.setItem("flowforge_token", data.access_token);
      localStorage.setItem("flowforge_user", JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setMessage("Login successful.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function createWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      await apiFetch("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: workflowForm.name,
          description: workflowForm.description,
          status: workflowForm.status,
          definition: JSON.parse(workflowForm.definition),
        }),
      });
      setMessage("Workflow created.");
      await refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create failed");
    }
  }

  async function deleteWorkflow(id: string) {
    setMessage("");
    try {
      await apiFetch(`/workflows/${id}`, { method: "DELETE" });
      setMessage("Workflow deleted.");
      setSelectedWorkflow(null);
      await refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function triggerWorkflow(id: string) {
    setMessage("");
    try {
      await apiFetch(`/execution/trigger/${id}`, { method: "POST" });
      setMessage("Workflow triggered.");
      await refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trigger failed");
    }
  }

  async function selectRun(run: WorkflowRun) {
    setSelectedRun(null);
    setFailureAnalysis(null);
    setLiveEvents([]);
    setLiveStatus("connecting");
    setMessage("");
    try {
      setSelectedRun(await apiFetch<RunDetail>(`/runs/${run.id}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Run load failed");
    }
  }

  async function analyzeRun(runId: string) {
    setFailureAnalysis(null);
    setMessage("");
    try {
      setFailureAnalysis(
        await apiFetch<FailureAnalysis>(`/ai/runs/${runId}/failure-analysis`),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis failed");
    }
  }

  async function loadDocs() {
    setMessage("");
    try {
      setDocsSpec(await apiFetch<Record<string, unknown>>("/docs/openapi.json"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Docs load failed");
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
    setLiveStatus("idle");
    setLiveEvents([]);
  }

  if (!token || !user) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-950">
        <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-8 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
              FlowForge Console
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.055em] md:text-7xl">
              Workflow operations, clearly managed.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Minimal admin dashboard untuk workflow, run history, DAG visual,
              AI failure analysis, dan API documentation.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Secure access
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
              Sign in
            </h2>
            <label className="mt-7 block text-sm font-bold text-slate-700">
              Email
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Password
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button
              className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
            {message && <p className="mt-4 text-sm text-slate-500">{message}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-slate-950 px-4 py-5 text-white lg:block">
        <div className="mb-8">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-base font-black text-slate-950">
            F
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.05em]">
            FlowForge
          </h1>
          <p className="text-sm text-slate-400">Admin operations console</p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`w-full rounded-xl px-3 py-3 text-left transition ${
                activeView === item.key
                  ? "bg-white text-slate-950"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
              onClick={() => setActiveView(item.key)}
            >
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="text-xs opacity-65">{item.hint}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="font-bold">{user.name}</p>
          <p className="text-sm text-slate-400">
            {user.role} / {user.tenant.slug}
          </p>
          <button
            className="mt-4 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {activeView}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                {navItems.find((item) => item.key === activeView)?.label}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300"
                onClick={() => void refreshDashboard()}
              >
                Refresh
              </button>
              <a
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
                href={`${API_BASE_URL}/docs`}
                target="_blank"
                rel="noreferrer"
              >
                API Docs
              </a>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                  activeView === item.key
                    ? "bg-slate-950 text-white"
                    : "bg-white text-slate-600"
                }`}
                onClick={() => setActiveView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-5 py-6">
          {message && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">
              {message}
            </div>
          )}

          {activeView === "overview" && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoTile label="Active runs" value={overview?.activeRuns ?? 0} />
                <InfoTile label="Runs 24h" value={overview?.totalRuns ?? 0} />
                <InfoTile
                  label="Success rate"
                  value={`${Math.round((overview?.successRate ?? 0) * 100)}%`}
                />
                <InfoTile
                  label="Avg duration"
                  value={`${overview?.averageDurationMs ?? 0}ms`}
                />
              </div>
              <div className="grid gap-5 xl:grid-cols-[0.85fr_1.3fr_0.85fr]">
                <Panel title="Workflows" eyebrow={`${workflows.length} loaded`}>
                  <WorkflowList
                    workflows={workflows.slice(0, 4)}
                    selectedWorkflow={selectedWorkflow}
                    user={user}
                    onSelect={setSelectedWorkflow}
                    onTrigger={triggerWorkflow}
                    onDelete={deleteWorkflow}
                  />
                </Panel>
                <Panel
                  title="DAG Preview"
                  eyebrow={selectedDefinition?.name ?? "Select workflow"}
                >
                  <DagVisual definition={selectedDefinition} compact />
                </Panel>
                <Panel title="Latest Runs" eyebrow={`${runs.length} loaded`}>
                  <RunList runs={runs.slice(0, 6)} onSelect={selectRun} />
                </Panel>
              </div>
            </div>
          )}

          {activeView === "workflows" && (
            <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <Panel title="Create Workflow" eyebrow="CRUD">
                <form className="space-y-4" onSubmit={createWorkflow}>
                  <Input
                    label="Name"
                    value={workflowForm.name}
                    onChange={(value) =>
                      setWorkflowForm((current) => ({ ...current, name: value }))
                    }
                  />
                  <Input
                    label="Description"
                    value={workflowForm.description}
                    onChange={(value) =>
                      setWorkflowForm((current) => ({
                        ...current,
                        description: value,
                      }))
                    }
                  />
                  <label className="block text-sm font-bold text-slate-700">
                    Status
                    <select
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
                      value={workflowForm.status}
                      onChange={(event) =>
                        setWorkflowForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option>DRAFT</option>
                      <option>ACTIVE</option>
                      <option>ARCHIVED</option>
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Definition JSON
                    <textarea
                      className="mt-2 h-72 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-xs leading-5 text-slate-100 outline-none"
                      value={workflowForm.definition}
                      onChange={(event) =>
                        setWorkflowForm((current) => ({
                          ...current,
                          definition: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-40"
                    disabled={user.role === "VIEWER"}
                  >
                    Create workflow
                  </button>
                </form>
              </Panel>
              <Panel title="Workflow List" eyebrow={`${workflows.length} loaded`}>
                <WorkflowList
                  workflows={workflows}
                  selectedWorkflow={selectedWorkflow}
                  user={user}
                  onSelect={setSelectedWorkflow}
                  onTrigger={triggerWorkflow}
                  onDelete={deleteWorkflow}
                />
              </Panel>
            </div>
          )}

          {activeView === "runs" && (
            <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
              <Panel title="Run History" eyebrow={`${runs.length} latest`}>
                <RunList runs={runs} selectedRun={selectedRun} onSelect={selectRun} />
              </Panel>
              <RunDetailPanel
                selectedRun={selectedRun}
                failureAnalysis={failureAnalysis}
                liveStatus={liveStatus}
                liveEvents={liveEvents}
                onAnalyze={analyzeRun}
              />
            </div>
          )}

          {activeView === "dag" && (
            <Panel
              title="DAG Visual"
              eyebrow={selectedDefinition?.name ?? "Select workflow or run"}
            >
              <DagVisual definition={selectedDefinition} />
            </Panel>
          )}

          {activeView === "ai" && (
            <RunDetailPanel
              selectedRun={selectedRun}
              failureAnalysis={failureAnalysis}
              liveStatus={liveStatus}
              liveEvents={liveEvents}
              onAnalyze={analyzeRun}
            />
          )}

          {activeView === "docs" && (
            <Panel title="API Docs" eyebrow="Admin protected">
              <div className="space-y-4">
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Browser biasa tidak otomatis mengirim header JWT saat membuka
                  `/docs`. Tombol JSON di bawah mengambil spec dengan token aktif.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"
                    onClick={() => void loadDocs()}
                  >
                    Load JSON Docs
                  </button>
                  <a
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700"
                    href={`${API_BASE_URL}/docs`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open /docs
                  </a>
                </div>
                <pre className="max-h-[560px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {docsSpec
                    ? JSON.stringify(docsSpec, null, 2)
                    : "Docs JSON belum dimuat."}
                </pre>
              </div>
            </Panel>
          )}
        </div>
      </section>
    </main>
  );
}

function WorkflowList({
  workflows,
  selectedWorkflow,
  user,
  onSelect,
  onTrigger,
  onDelete,
}: {
  workflows: Workflow[];
  selectedWorkflow: Workflow | null;
  user: ApiUser;
  onSelect: (workflow: Workflow) => void;
  onTrigger: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {workflows.map((workflow) => (
        <article
          key={workflow.id}
          className={`rounded-xl border p-4 transition ${
            selectedWorkflow?.id === workflow.id
              ? "border-slate-400 bg-slate-50"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => onSelect(workflow)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSelect(workflow);
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold tracking-[-0.02em]">
                  {workflow.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  v{workflow.currentVersionNo} / {workflow._count?.runs ?? 0} runs
                </p>
              </div>
              <StatusBadge status={workflow.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {workflow.description || "No description."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              disabled={user.role === "VIEWER"}
              onClick={() => void onTrigger(workflow.id)}
            >
              Trigger
            </button>
            <button
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40"
              disabled={user.role !== "ADMIN"}
              onClick={() => void onDelete(workflow.id)}
            >
              Delete
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
              {workflow.versions?.[0]?.definitionJson?.nodes?.length ?? 0} steps
            </span>
          </div>
        </article>
      ))}
      {workflows.length === 0 && (
        <EmptyState text="Belum ada workflow. Buat workflow pertama dari menu Workflows." />
      )}
    </div>
  );
}

function RunList({
  runs,
  selectedRun,
  onSelect,
}: {
  runs: WorkflowRun[];
  selectedRun?: RunDetail | null;
  onSelect: (run: WorkflowRun) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <button
          key={run.id}
          className={`w-full rounded-xl border p-4 text-left transition hover:border-slate-300 ${
            selectedRun?.id === run.id
              ? "border-slate-400 bg-slate-50"
              : "border-slate-200 bg-white"
          }`}
          onClick={() => void onSelect(run)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold tracking-[-0.02em]">
                {run.workflow?.name ?? run.workflowId}
              </h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                {run.triggerType}
              </p>
            </div>
            <StatusBadge status={run.status} />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {formatDate(run.startedAt)} / {run.durationMs ?? 0}ms
          </p>
        </button>
      ))}
      {runs.length === 0 && <EmptyState text="Belum ada run history." />}
    </div>
  );
}

function RunDetailPanel({
  selectedRun,
  failureAnalysis,
  liveStatus,
  liveEvents,
  onAnalyze,
}: {
  selectedRun: RunDetail | null;
  failureAnalysis: FailureAnalysis | null;
  liveStatus: "idle" | "connecting" | "connected" | "closed";
  liveEvents: ExecutionSseEvent[];
  onAnalyze: (runId: string) => Promise<void>;
}) {
  return (
    <Panel title="Run Detail" eyebrow={selectedRun?.id ?? "Pick a run"}>
      {selectedRun ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Realtime SSE
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Step status akan berubah otomatis saat event backend masuk.
              </p>
            </div>
            <StatusBadge status={liveStatus.toUpperCase()} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile label="Status" value={selectedRun.status} />
            <InfoTile label="Trigger" value={selectedRun.triggerType} />
            <InfoTile label="Duration" value={`${selectedRun.durationMs ?? 0}ms`} />
          </div>
          <button
            className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
            onClick={() => void onAnalyze(selectedRun.id)}
          >
            Analyze Failure
          </button>
          {failureAnalysis && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">AI Failure Analysis</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase text-slate-700">
                  {failureAnalysis.source} / {failureAnalysis.confidence}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-700">
                {failureAnalysis.summary}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                <strong>Likely cause:</strong> {failureAnalysis.likelyCause}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                <strong>Suggested fix:</strong> {failureAnalysis.suggestedFix}
              </p>
            </div>
          )}
          <div className="space-y-3">
            {selectedRun.steps.map((step) => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <strong>{step.stepId}</strong>
                  <StatusBadge status={step.status} />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {step.stepType} / attempt {step.attemptNo} /{" "}
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
          {liveEvents.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">Live event tail</h3>
              <div className="mt-3 space-y-2">
                {liveEvents.map((event) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    key={`${event.emittedAt}-${event.type}-${event.data.stepId ?? "run"}`}
                  >
                    <span className="font-bold text-slate-700">
                      {event.type}
                    </span>
                    <span className="text-slate-500">
                      {event.data.stepId ?? event.runId} /{" "}
                      {event.data.status ?? "event"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState text="Pilih run untuk melihat detail step dan logs." />
      )}
    </Panel>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "SUCCEEDED" || status === "ACTIVE"
      ? "bg-teal-50 text-teal-700 ring-teal-100"
      : status === "FAILED" || status === "TIMEOUT"
        ? "bg-red-50 text-red-700 ring-red-100"
        : status === "RUNNING"
          ? "bg-amber-50 text-amber-700 ring-amber-100"
          : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${color}`}>
      {status}
    </span>
  );
}

function DagVisual({
  definition,
  compact = false,
}: {
  definition: WorkflowDefinition | undefined;
  compact?: boolean;
}) {
  if (!definition) {
    return <EmptyState text="Belum ada workflow definition untuk divisualkan." />;
  }

  const width = 760;
  const height = Math.max(compact ? 220 : 260, definition.nodes.length * 92);
  const positions = new Map(
    definition.nodes.map((node, index) => [
      node.id,
      { x: 90 + (index % 2) * 330, y: 60 + index * 82 },
    ]),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`${compact ? "h-[430px]" : "h-[560px]"} w-full`}
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
            <path d="M0,0 L8,4 L0,8 Z" fill="#14b8a6" />
          </marker>
        </defs>
        {definition.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              markerEnd="url(#arrow)"
              stroke="#14b8a6"
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
                fill="#f8fafc"
                height="68"
                rx="18"
                width="230"
                x={position.x}
                y={position.y}
              />
              <text
                fill="#0f172a"
                fontSize="16"
                fontWeight="900"
                x={position.x + 18}
                y={position.y + 30}
              >
                {node.name.slice(0, 20)}
              </text>
              <text
                fill="#0f766e"
                fontSize="13"
                fontWeight="800"
                x={position.x + 18}
                y={position.y + 52}
              >
                {node.id} / {node.type}
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "not started";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
