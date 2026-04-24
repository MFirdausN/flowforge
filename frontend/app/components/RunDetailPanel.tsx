import type {
  ExecutionSseEvent,
  FailureAnalysis,
  LiveStatus,
  RunDetail,
} from "../lib/types";
import { EmptyState, InfoTile, Panel, StatusBadge } from "./ui";

export function RunDetailPanel({
  selectedRun,
  failureAnalysis,
  liveStatus,
  liveEvents,
  onAnalyze,
}: {
  selectedRun: RunDetail | null;
  failureAnalysis: FailureAnalysis | null;
  liveStatus: LiveStatus;
  liveEvents: ExecutionSseEvent[];
  onAnalyze: (runId: string) => Promise<void>;
}) {
  const safeSteps = Array.isArray(selectedRun?.steps)
    ? selectedRun.steps.filter(
        (
          step,
        ): step is NonNullable<RunDetail["steps"]>[number] & {
          stepId: string;
          stepType: string;
          status: string;
        } => Boolean(step?.id),
      )
    : [];
  const safeEvents = Array.isArray(liveEvents)
    ? liveEvents.filter((event): event is ExecutionSseEvent => Boolean(event?.emittedAt))
    : [];

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
            <InfoTile label="Status" value={selectedRun.status ?? "UNKNOWN"} />
            <InfoTile label="Trigger" value={selectedRun.triggerType ?? "UNKNOWN"} />
            <InfoTile
              label="Duration"
              value={`${selectedRun.durationMs ?? 0}ms`}
            />
          </div>
          <button
            type="button"
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
            {safeSteps.map((step) => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <strong>{step.stepId ?? "Unknown step"}</strong>
                  <StatusBadge status={step.status ?? "UNKNOWN"} />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {step.stepType ?? "unknown"} / attempt {step.attemptNo ?? 0} /{" "}
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
          {safeEvents.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">Live event tail</h3>
              <div className="mt-3 space-y-2">
                {safeEvents.map((event) => (
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
