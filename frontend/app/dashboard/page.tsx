"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../components/AdminShell";
import { DagVisual } from "../components/DagVisual";
import { DocsPanel } from "../components/DocsPanel";
import { RunDetailPanel } from "../components/RunDetailPanel";
import { RunList } from "../components/RunList";
import { WorkflowForm } from "../components/WorkflowForm";
import { WorkflowList } from "../components/WorkflowList";
import { EmptyState, InfoTile, Panel, ScorePill, StatusBadge } from "../components/ui";
import { API_BASE_URL, baseNavItems, sampleDefinition } from "../lib/constants";
import { clearSession, readSession } from "../lib/session";
import type {
  ApiUser,
  BlogPost,
  ContentReview,
  ExecutionSseEvent,
  FailureAnalysis,
  HealthOverview,
  LiveStatus,
  ManagedUser,
  RunDetail,
  ViewKey,
  Workflow,
  WorkflowFormState,
  WorkflowListResponse,
  WorkflowRun,
} from "../lib/types";

type ToolView = "overview" | "workflows" | "runs" | "dag" | "ai" | "docs";
type RunListResponse = { data: WorkflowRun[] };

const emptyPostForm = {
  title: "",
  excerpt: "",
  content: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Editorial workspace ready");
  const [isLoading, setIsLoading] = useState(false);

  const [publishedPosts, setPublishedPosts] = useState<BlogPost[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [postForm, setPostForm] = useState(emptyPostForm);
  const [draftReview, setDraftReview] = useState<ContentReview | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("home");

  const [toolView, setToolView] = useState<ToolView>("overview");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [failureAnalysis, setFailureAnalysis] = useState<FailureAnalysis | null>(null);
  const [docsSpec, setDocsSpec] = useState<Record<string, unknown> | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [liveEvents, setLiveEvents] = useState<ExecutionSseEvent[]>([]);
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>({
    name: "SEVIMA Demo Workflow",
    description: "HTTP, delay, condition, and script sample",
    status: "ACTIVE",
    definition: sampleDefinition,
  });

  const pendingPosts = posts.filter((post) => post.status === "PENDING_REVIEW");
  const publishedCount = posts.filter((post) => post.status === "PUBLISHED").length;
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const selectedDefinition =
    selectedRun?.workflowVersion?.definitionJson ??
    selectedWorkflow?.versions?.[0]?.definitionJson;

  const navItems = useMemo(() => {
    if (!user) {
      return [];
    }

    return baseNavItems.filter((item) => {
      if (item.key === "review") {
        return user.role === "ADMIN" || user.role === "EDITOR";
      }

      if (item.key === "users" || item.key === "tools") {
        return user.role === "ADMIN";
      }

      return true;
    });
  }, [user]);

  async function apiFetch<T>(path: string, init: RequestInit = {}, withAuth = true): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message ?? "Request failed");
    }

    return response.json() as Promise<T>;
  }

  async function loadPublicPosts() {
    try {
      const data = await apiFetch<BlogPost[]>("/posts/published", {}, false);
      setPublishedPosts(data);
    } catch {
      setPublishedPosts([]);
    }
  }

  async function loadDashboard(currentUser: ApiUser) {
    const postData = await apiFetch<BlogPost[]>("/posts");
    setPosts(postData);

    if (!selectedPostId && postData.length > 0) {
      hydratePostEditor(postData[0]);
    }

    if (currentUser.role === "ADMIN") {
      const [userData, workflowData, runData, overviewData] = await Promise.all([
        apiFetch<ManagedUser[]>("/users"),
        apiFetch<WorkflowListResponse>("/workflows"),
        apiFetch<RunListResponse>("/runs"),
        apiFetch<HealthOverview>("/health/overview"),
      ]);

      setManagedUsers(userData);
      setWorkflows(workflowData.data);
      setRuns(runData.data);
      setOverview(overviewData);
      setSelectedWorkflow((current) => current ?? workflowData.data[0] ?? null);
    } else {
      setManagedUsers([]);
      setWorkflows([]);
      setRuns([]);
      setOverview(null);
      setSelectedRun(null);
      setSelectedWorkflow(null);
    }
  }

  function hydratePostEditor(post: BlogPost) {
    setSelectedPostId(post.id);
    setPostForm({
      title: post.title,
      excerpt: post.excerpt ?? "",
      content: post.content,
    });
    setDraftReview(post.contentReview ?? null);
  }

  function resetPostEditor() {
    setSelectedPostId(null);
    setPostForm(emptyPostForm);
    setDraftReview(null);
  }

  useEffect(() => {
    void loadPublicPosts();

    const session = readSession();
    if (!session) {
      router.replace("/");
      setReady(true);
      return;
    }

    setToken(session.token);
    setUser(session.user);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    void loadDashboard(user).catch((error: Error) => setMessage(error.message));
  }, [user, token]);

  useEffect(() => {
    if (!token || !selectedRun?.id || user?.role !== "ADMIN") {
      return;
    }

    const runId = selectedRun.id;
    const abortController = new AbortController();
    let buffer = "";

    async function connect() {
      try {
        setLiveStatus("connecting");
        const response = await fetch(`${API_BASE_URL}/execution/runs/${runId}/events`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Unable to connect realtime stream");
        }

        setLiveStatus("connected");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (!abortController.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
            if (!dataLine) {
              continue;
            }

            const payload = JSON.parse(dataLine.slice(5).trim()) as ExecutionSseEvent;
            setLiveEvents((current) => [payload, ...current].slice(0, 12));
            setRuns((current) =>
              current.map((run) =>
                run.id === payload.runId && payload.data.status
                  ? { ...run, status: payload.data.status }
                  : run,
              ),
            );
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setLiveStatus("closed");
          setMessage(error instanceof Error ? error.message : "Realtime stream closed");
        }
      }
    }

    void connect();

    return () => {
      abortController.abort();
      setLiveStatus("closed");
    };
  }, [selectedRun?.id, token, user?.role]);

  async function savePost(intent: "draft" | "submit" | "publish") {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setMessage(intent === "draft" ? "Saving draft..." : "Saving post...");

    try {
      const path = selectedPostId ? `/posts/${selectedPostId}` : "/posts";
      const method = selectedPostId ? "PATCH" : "POST";

      await apiFetch<BlogPost>(path, {
        method,
        body: JSON.stringify({
          title: postForm.title,
          excerpt: postForm.excerpt,
          content: postForm.content,
          intent,
        }),
      });

      await loadDashboard(user);
      await loadPublicPosts();
      setMessage(
        intent === "publish"
          ? "Post published"
          : intent === "submit"
            ? "Post submitted for editorial review"
            : "Draft saved",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save post");
    } finally {
      setIsLoading(false);
    }
  }

  async function runDraftChecks() {
    if (!postForm.title || !postForm.content) {
      setMessage("Isi title dan content dulu sebelum menjalankan AI checks");
      return;
    }

    setIsLoading(true);
    setMessage("Running SEO, plagiarism, and sensitive-content checks...");

    try {
      const review = await apiFetch<ContentReview>("/ai/posts/content-review", {
        method: "POST",
        body: JSON.stringify({
          title: postForm.title,
          excerpt: postForm.excerpt,
          content: postForm.content,
        }),
      });

      setDraftReview(review);
      setMessage("AI checks completed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run AI checks");
    } finally {
      setIsLoading(false);
    }
  }

  async function publishPost(postId: string) {
    if (!user) {
      return;
    }

    try {
      await apiFetch(`/posts/${postId}/publish`, { method: "POST" });
      await loadDashboard(user);
      await loadPublicPosts();
      setMessage("Post published by editorial desk");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish post");
    }
  }

  async function unpublishPost(postId: string) {
    if (!user) {
      return;
    }

    try {
      await apiFetch(`/posts/${postId}/unpublish`, { method: "POST" });
      await loadDashboard(user);
      await loadPublicPosts();
      setMessage("Post moved back to draft");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to unpublish post");
    }
  }

  async function updateUserRole(userId: string, role: ApiUser["role"]) {
    try {
      await apiFetch(`/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      if (user?.role === "ADMIN") {
        await loadDashboard(user);
      }
      setMessage("User role updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user role");
    }
  }

  async function refreshTools() {
    if (!user || user.role !== "ADMIN") {
      return;
    }

    const [workflowData, runData, overviewData] = await Promise.all([
      apiFetch<WorkflowListResponse>("/workflows"),
      apiFetch<RunListResponse>("/runs"),
      apiFetch<HealthOverview>("/health/overview"),
    ]);

    setWorkflows(workflowData.data);
    setRuns(runData.data);
    setOverview(overviewData);
    setSelectedWorkflow((current) => current ?? workflowData.data[0] ?? null);
  }

  async function createWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      await apiFetch<Workflow>("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: workflowForm.name,
          description: workflowForm.description,
          status: workflowForm.status,
          definition: JSON.parse(workflowForm.definition),
        }),
      });
      await refreshTools();
      setMessage("Workflow created");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create workflow");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteWorkflow(workflow: Workflow) {
    if (!window.confirm(`Archive workflow "${workflow.name}"?`)) {
      return;
    }

    try {
      await apiFetch(`/workflows/${workflow.id}`, { method: "DELETE" });
      await refreshTools();
      setMessage(`${workflow.name} archived`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive workflow");
    }
  }

  async function triggerWorkflow(workflow: Workflow) {
    try {
      const run = await apiFetch<WorkflowRun>(`/execution/trigger/${workflow.id}`, {
        method: "POST",
        body: JSON.stringify({ triggerType: "MANUAL" }),
      });
      await refreshTools();
      await selectRun(run.id);
      setToolView("runs");
      setMessage(`Run ${run.id.slice(0, 8)} started`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to trigger workflow");
    }
  }

  async function selectRun(runId: string) {
    try {
      const detail = await apiFetch<RunDetail>(`/runs/${runId}`);
      setSelectedRun(detail);
      setFailureAnalysis(null);
      setLiveEvents([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load run detail");
    }
  }

  async function analyzeRun() {
    if (!selectedRun) {
      return;
    }

    try {
      const analysis = await apiFetch<FailureAnalysis>(
        `/ai/runs/${selectedRun.id}/failure-analysis`,
      );
      setFailureAnalysis(analysis);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to analyze run");
    }
  }

  async function loadDocs() {
    try {
      const docs = await apiFetch<Record<string, unknown>>("/docs/openapi.json");
      setDocsSpec(docs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load API docs");
    }
  }

  function logout() {
    clearSession();
    setToken("");
    setUser(null);
    setPosts([]);
    setManagedUsers([]);
    resetPostEditor();
    setMessage("Signed out");
    router.push("/");
  }

  function renderHome() {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <InfoTile label="My posts" value={posts.length} />
          <InfoTile label="Published" value={publishedCount} />
          <InfoTile label="Waiting review" value={pendingPosts.length} />
          <InfoTile label="Public stories" value={publishedPosts.length} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Editorial snapshot" eyebrow={`${user?.role} workspace`}>
            <div className="space-y-4">
              <p className="text-sm leading-7 text-stone-600">
                User bisa membuat draft dan submit untuk review. Editor dan admin bisa
                langsung publish, sementara feed publik tetap tersedia di halaman utama.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {posts.slice(0, 4).map((post) => (
                  <button
                    key={post.id}
                    className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-left transition hover:border-stone-400"
                    onClick={() => {
                      hydratePostEditor(post);
                      setActiveView("posts");
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong>{post.title}</strong>
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="mt-3 text-sm text-stone-600">
                      {post.excerpt || `${post.content.slice(0, 100)}...`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Access model" eyebrow="Role policy">
            <div className="space-y-3 text-sm leading-7 text-stone-600">
              <p>`USER` dapat register, login, membuat draft, dan submit posting.</p>
              <p>`EDITOR` ditambahkan admin dan dapat publish tanpa approval tambahan.</p>
              <p>`ADMIN` mengatur role user, review, publish, dan membuka menu `Tools`.</p>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderPosts() {
    const canDirectPublish = user?.role === "ADMIN" || user?.role === "EDITOR";
    const reviewToDisplay = draftReview ?? selectedPost?.contentReview ?? null;

    return (
      <div className="grid gap-5 xl:grid-cols-[0.88fr_0.74fr_0.88fr]">
        <Panel
          title={selectedPostId ? "Edit Post" : "Write a New Post"}
          eyebrow={selectedPostId ? "Existing post" : "Draft first"}
        >
          <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
            <label className="block text-sm font-bold text-stone-700">
              Title
              <input
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none"
                value={postForm.title}
                onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-bold text-stone-700">
              Excerpt
              <textarea
                className="mt-2 h-28 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none"
                value={postForm.excerpt}
                onChange={(event) => setPostForm((current) => ({ ...current, excerpt: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-bold text-stone-700">
              Content
              <textarea
                className="mt-2 h-80 w-full rounded-[1.75rem] border border-stone-900 bg-stone-950 px-4 py-4 text-sm leading-7 text-stone-100 outline-none"
                value={postForm.content}
                onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-bold text-sky-900 disabled:opacity-50"
                disabled={isLoading || !postForm.title || !postForm.content}
                onClick={() => void runDraftChecks()}
              >
                Run AI checks
              </button>
              <button
                className="rounded-2xl bg-stone-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={isLoading || !postForm.title || !postForm.content}
                onClick={() => void savePost("draft")}
              >
                Save draft
              </button>
              <button
                className="rounded-2xl border border-amber-300 bg-amber-100 px-5 py-3 text-sm font-bold text-amber-950 disabled:opacity-50"
                disabled={isLoading || !postForm.title || !postForm.content}
                onClick={() => void savePost(canDirectPublish ? "publish" : "submit")}
              >
                {canDirectPublish ? "Publish now" : "Submit for review"}
              </button>
              <button
                className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-700"
                type="button"
                onClick={resetPostEditor}
              >
                New post
              </button>
            </div>
          </form>
        </Panel>
        <Panel title="Your Post Queue" eyebrow={`${posts.length} items`}>
          <div className="space-y-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className={`rounded-3xl border p-4 transition ${
                  selectedPostId === post.id
                    ? "border-stone-400 bg-stone-50"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{post.title}</h3>
                    <p className="mt-2 text-sm text-stone-600">
                      {post.excerpt || `${post.content.slice(0, 120)}...`}
                    </p>
                  </div>
                  <StatusBadge status={post.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-2xl bg-stone-950 px-3 py-2 text-xs font-bold text-white"
                    onClick={() => hydratePostEditor(post)}
                  >
                    Edit
                  </button>
                  {(user?.role === "ADMIN" || user?.role === "EDITOR") &&
                    post.status !== "PUBLISHED" && (
                      <button
                        className="rounded-2xl bg-amber-300 px-3 py-2 text-xs font-bold text-stone-950"
                        onClick={() => void publishPost(post.id)}
                      >
                        Publish
                      </button>
                    )}
                  {post.status === "PUBLISHED" &&
                    (user?.role === "ADMIN" || user?.role === "EDITOR") && (
                      <button
                        className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700"
                        onClick={() => void unpublishPost(post.id)}
                      >
                        Unpublish
                      </button>
                    )}
                </div>
              </article>
            ))}
            {posts.length === 0 && <EmptyState text="Belum ada tulisan. Mulai dari draft pertama." />}
          </div>
        </Panel>
        <Panel
          title="Post Intelligence"
          eyebrow={selectedPost ? selectedPost.status : draftReview ? "Draft review" : "AI review"}
        >
          {reviewToDisplay ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Summary
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{reviewToDisplay.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge status={reviewToDisplay.recommendation.toUpperCase()} />
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                    {reviewToDisplay.source}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ScorePill label="SEO score" value={`${reviewToDisplay.seo.score}/100`} />
                <ScorePill
                  label="Plagiarism risk"
                  value={`${reviewToDisplay.plagiarism.risk} (${reviewToDisplay.plagiarism.score})`}
                />
                <ScorePill
                  label="Sensitive risk"
                  value={`${reviewToDisplay.sensitiveContent.risk} (${reviewToDisplay.sensitiveContent.score})`}
                />
                <ScorePill
                  label="Keyword density"
                  value={reviewToDisplay.seo.keywordDensity}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    SEO criteria
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                    <li>Title length: {reviewToDisplay.seo.titleLengthOk ? "OK" : "Needs work"}</li>
                    <li>Excerpt length: {reviewToDisplay.seo.excerptLengthOk ? "OK" : "Needs work"}</li>
                    {reviewToDisplay.seo.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Plagiarism criteria
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                    <li>
                      Repeated sentences: {reviewToDisplay.plagiarism.repeatedSentenceCount}
                    </li>
                    {reviewToDisplay.plagiarism.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Sensitive content criteria
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                    <li>
                      Categories:{" "}
                      {reviewToDisplay.sensitiveContent.categories.length > 0
                        ? reviewToDisplay.sensitiveContent.categories.join(", ")
                        : "No notable categories"}
                    </li>
                    {reviewToDisplay.sensitiveContent.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState text="Belum ada hasil AI review. Jalankan AI checks atau pilih post yang sudah pernah diperiksa." />
          )}
        </Panel>
      </div>
    );
  }

  function renderReview() {
    return (
      <Panel title="Editorial Review Desk" eyebrow={`${pendingPosts.length} pending`}>
        <div className="space-y-4">
          {pendingPosts.map((post) => (
            <article key={post.id} className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">{post.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    {post.excerpt || `${post.content.slice(0, 200)}...`}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                    By {post.author.name} / {post.slug}
                  </p>
                </div>
                <StatusBadge status={post.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-stone-950 px-4 py-2 text-sm font-bold text-white"
                  onClick={() => void publishPost(post.id)}
                >
                  Publish
                </button>
                <button
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700"
                  onClick={() => {
                    hydratePostEditor(post);
                    setActiveView("posts");
                  }}
                >
                  Open in editor
                </button>
              </div>
            </article>
          ))}
          {pendingPosts.length === 0 && (
            <EmptyState text="Inbox review kosong. Tidak ada posting yang menunggu editor." />
          )}
        </div>
      </Panel>
    );
  }

  function renderUsers() {
    return (
      <Panel title="User Management" eyebrow={`${managedUsers.length} members`}>
        <div className="space-y-3">
          {managedUsers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-3xl border border-stone-200 bg-stone-50 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-stone-600">{member.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={member.isActive ? member.role : "INACTIVE"} />
                <select
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700"
                  value={member.role}
                  onChange={(event) =>
                    void updateUserRole(member.id, event.target.value as ApiUser["role"])
                  }
                >
                  <option value="USER">USER</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderTools() {
    const toolTabs: Array<{ key: ToolView; label: string }> = [
      { key: "overview", label: "Overview" },
      { key: "workflows", label: "Workflows" },
      { key: "runs", label: "Runs" },
      { key: "dag", label: "DAG" },
      { key: "ai", label: "AI" },
      { key: "docs", label: "Docs" },
    ];

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {toolTabs.map((tab) => (
            <button
              key={tab.key}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                toolView === tab.key ? "bg-stone-950 text-white" : "bg-white text-stone-600"
              }`}
              onClick={() => setToolView(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {toolView === "overview" && (
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
                  user={user!}
                  onSelect={setSelectedWorkflow}
                  onTrigger={triggerWorkflow}
                  onDelete={deleteWorkflow}
                />
              </Panel>
              <Panel title="DAG Preview" eyebrow={selectedDefinition?.name ?? "Select workflow"}>
                <DagVisual definition={selectedDefinition} compact />
              </Panel>
              <Panel title="Latest Runs" eyebrow={`${runs.length} loaded`}>
                <RunList runs={runs.slice(0, 6)} onSelect={selectRun} />
              </Panel>
            </div>
          </div>
        )}

        {toolView === "workflows" && (
          <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <Panel title="Create Workflow" eyebrow="Legacy admin tool">
              <WorkflowForm
                user={user!}
                form={workflowForm}
                onSubmit={createWorkflow}
                onChange={setWorkflowForm}
              />
            </Panel>
            <Panel title="Workflow List" eyebrow={`${workflows.length} loaded`}>
              <WorkflowList
                workflows={workflows}
                selectedWorkflow={selectedWorkflow}
                user={user!}
                onSelect={setSelectedWorkflow}
                onTrigger={triggerWorkflow}
                onDelete={deleteWorkflow}
              />
            </Panel>
          </div>
        )}

        {toolView === "runs" && (
          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <Panel title="Run History" eyebrow={`${runs.length} latest`}>
              <RunList runs={runs} selectedRun={selectedRun} onSelect={selectRun} />
            </Panel>
            <RunDetailPanel
              selectedRun={selectedRun}
              failureAnalysis={failureAnalysis}
              liveStatus={liveStatus}
              liveEvents={liveEvents}
              onAnalyze={async () => {
                await analyzeRun();
              }}
            />
          </div>
        )}

        {toolView === "dag" && (
          <Panel title="DAG Visual" eyebrow={selectedDefinition?.name ?? "Select workflow"}>
            <DagVisual definition={selectedDefinition} />
          </Panel>
        )}

        {toolView === "ai" && (
          <RunDetailPanel
            selectedRun={selectedRun}
            failureAnalysis={failureAnalysis}
            liveStatus={liveStatus}
            liveEvents={liveEvents}
            onAnalyze={async () => {
              await analyzeRun();
            }}
          />
        )}

        {toolView === "docs" && (
          <DocsPanel docsSpec={docsSpec} onLoadDocs={() => void loadDocs()} />
        )}
      </div>
    );
  }

  function renderDashboardView() {
    if (activeView === "posts") {
      return renderPosts();
    }

    if (activeView === "review" && (user?.role === "ADMIN" || user?.role === "EDITOR")) {
      return renderReview();
    }

    if (activeView === "users" && user?.role === "ADMIN") {
      return renderUsers();
    }

    if (activeView === "tools" && user?.role === "ADMIN") {
      return renderTools();
    }

    return renderHome();
  }

  if (!ready) {
    return <main className="min-h-screen bg-stone-100" />;
  }

  if (!user || !token) {
    return <main className="min-h-screen bg-stone-100" />;
  }

  return (
    <AdminShell
      user={user}
      activeView={activeView}
      navItems={navItems}
      message={message}
      onViewChange={setActiveView}
      onRefresh={() => void loadDashboard(user)}
      onLogout={logout}
    >
      {renderDashboardView()}
    </AdminShell>
  );
}
