import type { FormEvent } from "react";
import type { ApiUser, WorkflowFormState } from "../lib/types";
import { Input } from "./ui";

export function WorkflowForm({
  user,
  form,
  onSubmit,
  onChange,
}: {
  user: ApiUser;
  form: WorkflowFormState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (nextForm: WorkflowFormState) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Input
        label="Name"
        value={form.name}
        onChange={(value) => onChange({ ...form, name: value })}
      />
      <Input
        label="Description"
        value={form.description}
        onChange={(value) => onChange({ ...form, description: value })}
      />
      <label className="block text-sm font-bold text-slate-700">
        Status
        <select
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
          value={form.status}
          onChange={(event) => onChange({ ...form, status: event.target.value })}
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
          value={form.definition}
          onChange={(event) =>
            onChange({ ...form, definition: event.target.value })
          }
        />
      </label>
      <button
        className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-40"
        disabled={user.role === "USER"}
      >
        Create workflow
      </button>
    </form>
  );
}
