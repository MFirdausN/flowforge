import type { FormEvent } from "react";

export function AuthScreen({
  mode,
  name,
  email,
  password,
  tenantSlug,
  message,
  isLoading,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onTenantSlugChange,
  onSubmit,
  variant = "full",
}: {
  mode: "login" | "register";
  name: string;
  email: string;
  password: string;
  tenantSlug: string;
  message: string;
  isLoading: boolean;
  onModeChange: (mode: "login" | "register") => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTenantSlugChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  variant?: "full" | "panel";
}) {
  if (variant === "panel") {
    return (
      <form
        onSubmit={onSubmit}
        className="rounded-[2rem] border border-white/70 bg-white/90 p-7 shadow-2xl shadow-stone-900/10 backdrop-blur"
      >
        <div className="flex gap-2 rounded-full bg-stone-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${mode === "login" ? "bg-stone-950 text-white" : "text-stone-600"}`}
            onClick={() => onModeChange("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${mode === "register" ? "bg-stone-950 text-white" : "text-stone-600"}`}
            onClick={() => onModeChange("register")}
          >
            Register
          </button>
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {mode === "login" ? "Secure access" : "Create writer account"}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          {mode === "login" ? "Welcome back" : "Start writing today"}
        </h2>
        {mode === "register" && (
          <label className="mt-7 block text-sm font-bold text-slate-700">
            Name
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
        )}
        <label className="mt-7 block text-sm font-bold text-slate-700">
          Email
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm font-bold text-slate-700">
          Password
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
        {mode === "register" && (
          <label className="mt-4 block text-sm font-bold text-slate-700">
            Tenant slug
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
              value={tenantSlug}
              onChange={(event) => onTenantSlugChange(event.target.value)}
            />
          </label>
        )}
        <button
          className="mt-6 w-full rounded-2xl bg-stone-950 px-5 py-3.5 font-bold text-white transition hover:bg-stone-800 disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading
            ? mode === "login"
              ? "Signing in..."
              : "Creating account..."
            : mode === "login"
              ? "Sign in"
              : "Register as user"}
        </button>
        {message && <p className="mt-4 text-sm text-slate-500">{message}</p>}
      </form>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7db,_#f5efe3_52%,_#eadfcf)] px-6 py-10 text-slate-950">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="mb-8 inline-flex rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-600 shadow-sm backdrop-blur">
            Blogger Platform
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.055em] md:text-7xl">
            Publish stories with editorial control, not chaos.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700">
            Landing page publik, dashboard penulis, review desk editor, dan admin
            tools lama tetap aman di area khusus.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Writers</p>
              <p className="mt-2 text-sm text-stone-700">Register, login, dan submit posting untuk direview.</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Editors</p>
              <p className="mt-2 text-sm text-stone-700">Moderasi tulisan dan publish tanpa approval tambahan.</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Admins</p>
              <p className="mt-2 text-sm text-stone-700">Kelola role user dan akses tools operasional lama.</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[2rem] border border-white/70 bg-white/90 p-7 shadow-2xl shadow-stone-900/10 backdrop-blur"
        >
          <div className="flex gap-2 rounded-full bg-stone-100 p-1">
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${mode === "login" ? "bg-stone-950 text-white" : "text-stone-600"}`}
              onClick={() => onModeChange("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${mode === "register" ? "bg-stone-950 text-white" : "text-stone-600"}`}
              onClick={() => onModeChange("register")}
            >
              Register
            </button>
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {mode === "login" ? "Secure access" : "Create writer account"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {mode === "login" ? "Welcome back" : "Start writing today"}
          </h2>
          {mode === "register" && (
            <label className="mt-7 block text-sm font-bold text-slate-700">
              Name
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </label>
          )}
          <label className="mt-7 block text-sm font-bold text-slate-700">
            Email
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </label>
          <label className="mt-4 block text-sm font-bold text-slate-700">
            Password
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>
          {mode === "register" && (
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Tenant slug
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white"
                value={tenantSlug}
                onChange={(event) => onTenantSlugChange(event.target.value)}
              />
            </label>
          )}
          <button
            className="mt-6 w-full rounded-2xl bg-stone-950 px-5 py-3.5 font-bold text-white transition hover:bg-stone-800 disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign in"
                : "Register as user"}
          </button>
          {message && <p className="mt-4 text-sm text-slate-500">{message}</p>}
        </form>
      </section>
    </main>
  );
}
