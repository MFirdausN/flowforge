import { API_BASE_URL } from "../lib/constants";
import { Panel } from "./ui";

export function DocsPanel({
  docsSpec,
  onLoadDocs,
}: {
  docsSpec: Record<string, unknown> | null;
  onLoadDocs: () => void;
}) {
  return (
    <Panel title="API Docs" eyebrow="Admin protected">
      <div className="space-y-4">
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Browser biasa tidak otomatis mengirim header JWT saat membuka `/docs`.
          Tombol JSON di bawah mengambil spec dengan token aktif.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"
            onClick={onLoadDocs}
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
  );
}
