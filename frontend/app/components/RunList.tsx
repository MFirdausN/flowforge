import { formatDate } from "../lib/format";
import type { RunDetail, WorkflowRun } from "../lib/types";
import { EmptyState, StatusBadge } from "./ui";

export function RunList({
  runs,
  selectedRun,
  onSelect,
}: {
  runs: WorkflowRun[];
  selectedRun?: RunDetail | null;
  onSelect: (runId: string) => Promise<void>;
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
          onClick={() => void onSelect(run.id)}
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
