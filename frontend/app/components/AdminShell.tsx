import type { ReactNode } from "react";
import { API_BASE_URL } from "../lib/constants";
import type { ApiUser, ViewKey } from "../lib/types";

export function AdminShell({
  user,
  activeView,
  message,
  children,
  navItems,
  onViewChange,
  onRefresh,
  onLogout,
}: {
  user: ApiUser;
  activeView: ViewKey;
  message: string;
  children: ReactNode;
  navItems: Array<{ key: ViewKey; label: string; hint: string }>;
  onViewChange: (view: ViewKey) => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const activeItem = navItems.find((item) => item.key === activeView);

  return (
    <main className="min-h-screen bg-stone-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-stone-900 bg-stone-950 px-5 py-6 text-white lg:block">
        <div className="mb-8">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300 text-base font-black text-stone-950">
            B
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em]">
            FlowForge Blogger
          </h1>
          <p className="text-sm text-stone-400">Editorial workspace and admin control</p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`w-full rounded-xl px-3 py-3 text-left transition ${
                activeView === item.key
                  ? "bg-amber-300 text-stone-950"
                  : "text-stone-300 hover:bg-stone-900 hover:text-white"
              }`}
              onClick={() => onViewChange(item.key)}
            >
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="text-xs opacity-65">{item.hint}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-stone-800 bg-stone-900 p-4">
          <p className="font-bold">{user.name}</p>
          <p className="text-sm text-slate-400">
            {user.role} / {user.tenant.slug}
          </p>
          <button
            className="mt-4 rounded-2xl bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <section className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                {activeView}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                {activeItem?.label}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 transition hover:border-stone-300"
                onClick={onRefresh}
              >
                Refresh
              </button>
              <a
                className="rounded-2xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white"
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
                    ? "bg-stone-950 text-white"
                    : "bg-white text-stone-600"
                }`}
                onClick={() => onViewChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-5 py-6">
          {message && (
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-600 shadow-sm">
              {message}
            </div>
          )}
          {children}
        </div>
      </section>
    </main>
  );
}
