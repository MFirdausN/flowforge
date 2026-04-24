import type { ApiUser, Workflow } from "../lib/types";
import { EmptyState, StatusBadge } from "./ui";

export function WorkflowList({
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
  onTrigger: (workflow: Workflow) => Promise<void>;
  onDelete: (workflow: Workflow) => Promise<void>;
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
                  v{workflow.currentVersionNo} / {workflow._count?.runs ?? 0}{" "}
                  runs
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
              type="button"
              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              disabled={user.role === "USER"}
              onClick={() => void onTrigger(workflow)}
            >
              Trigger
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40"
              disabled={user.role !== "ADMIN"}
              onClick={() => void onDelete(workflow)}
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
