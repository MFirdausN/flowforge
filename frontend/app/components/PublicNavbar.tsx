"use client";

import Link from "next/link";
import { clearSession } from "../lib/session";
import type { ApiUser } from "../lib/types";

export function PublicNavbar({
  user,
  onLogout,
}: {
  user: ApiUser | null;
  onLogout?: () => void;
}) {
  function handleLogout() {
    clearSession();
    onLogout?.();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-950 text-sm font-black text-amber-300">
            F
          </div>
          <div>
            <p className="text-sm font-bold text-stone-950">FlowForge Stories</p>
            <p className="text-xs text-stone-500">Public landing and editorial blog</p>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 sm:justify-end">
          <a
            href="#hero"
            className="rounded-full px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-100"
          >
            Home
          </a>
          <a
            href="#intro"
            className="rounded-full px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-100"
          >
            Intro
          </a>
          <a
            href="#blog"
            className="rounded-full px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-100"
          >
            Blog
          </a>
          <a
            href="#contact"
            className="rounded-full px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-100"
          >
            Contact
          </a>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-100"
              >
                Dashboard
              </Link>
              <span className="hidden rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950 md:inline-flex">
                {user.name} / {user.role}
              </span>
              <button
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a
                href="#auth"
                className="rounded-full px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-100"
              >
                Sign in
              </a>
              <a
                href="#auth"
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white"
              >
                Register
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
