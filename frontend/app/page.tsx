"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthScreen } from "./components/AuthScreen";
import { PublicNavbar } from "./components/PublicNavbar";
import { PublishedFeed } from "./components/PublishedFeed";
import { API_BASE_URL } from "./lib/constants";
import { readSession, writeSession } from "./lib/session";
import type { ApiUser, BlogPost } from "./lib/types";

type AuthMode = "login" | "register";

export default function HomePage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@tenant1.local");
  const [password, setPassword] = useState("password123");
  const [tenantSlug, setTenantSlug] = useState("tenant1");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [message, setMessage] = useState("Editorial system ready");
  const [isLoading, setIsLoading] = useState(false);
  const [publishedPosts, setPublishedPosts] = useState<BlogPost[]>([]);

  async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
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
      const data = await apiFetch<BlogPost[]>("/posts/published");
      setPublishedPosts(data);
    } catch {
      setPublishedPosts([]);
    }
  }

  useEffect(() => {
    void loadPublicPosts();
    const session = readSession();
    if (session) {
      setUser(session.user);
    }
  }, []);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(authMode === "login" ? "Signing in..." : "Creating your account...");

    try {
      const path = authMode === "login" ? "/auth/login" : "/auth/register";
      const body =
        authMode === "login"
          ? { email, password }
          : { name, email, password, tenantSlug };

      const session = await apiFetch<{ accessToken: string; user: ApiUser }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      writeSession({ token: session.accessToken, user: session.user });
      setUser(session.user);
      setMessage(`Welcome, ${session.user.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fbf4e6_0%,#f4eddc_30%,#efe7d5_62%,#f8f4eb_100%)] text-slate-950">
      <PublicNavbar
        user={user}
        onLogout={() => {
          setUser(null);
          setMessage("Signed out");
          router.push("/");
        }}
      />

      <section id="hero" className="relative overflow-hidden px-6 pb-10 pt-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_15%_20%,rgba(217,119,6,0.18),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(23,32,51,0.16),transparent_28%),radial-gradient(circle_at_50%_55%,rgba(255,255,255,0.75),transparent_44%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="py-10">
            <div className="inline-flex rounded-full border border-stone-300/80 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-stone-600 shadow-sm backdrop-blur">
              FlowForge Public Journal
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.065em] md:text-7xl">
              Stories, editorial rhythm, and a publishing system that feels calm on the surface.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700 md:text-xl">
              Landing page publik ini dibuat untuk pembaca dan tim editorial sekaligus:
              guest bisa menikmati artikel yang sudah terbit, sementara user login tetap
              bisa berpindah ke dashboard untuk menulis, meninjau, dan menerbitkan konten.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#blog"
                className="rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white"
              >
                Explore published stories
              </a>
              <a
                href="#contact"
                className="rounded-full border border-stone-300 bg-white/80 px-6 py-3 text-sm font-bold text-stone-700 backdrop-blur"
              >
                Contact the editorial desk
              </a>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.75rem] border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                  Public reading
                </p>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  Pembaca bisa membuka feed dan detail artikel tanpa harus login lebih dulu.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                  Editorial flow
                </p>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  Writer, editor, dan admin bekerja dari dashboard tanpa memutus pengalaman membaca publik.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                  One platform
                </p>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  Blog publik dan workspace internal hidup berdampingan dalam satu alur yang rapi.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 hidden h-32 w-32 rounded-full bg-amber-300/35 blur-2xl lg:block" />
            <div className="absolute -right-6 bottom-10 hidden h-40 w-40 rounded-full bg-stone-900/10 blur-3xl lg:block" />
            {user ? (
              <section className="relative rounded-[2.2rem] border border-white/70 bg-white/92 p-7 shadow-2xl shadow-stone-900/10 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Logged in
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  Welcome back, {user.name}
                </h2>
                <p className="mt-4 text-sm leading-7 text-stone-600">
                  Anda sedang login sebagai {user.role}. Feed publik tetap terbuka untuk
                  dibaca, dan dashboard siap dipakai saat Anda ingin menulis atau mengelola konten.
                </p>
                <div className="mt-8 rounded-[1.75rem] bg-stone-100 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                    Quick route
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-stone-700">
                    <p>1. Nikmati published stories dari landing page ini.</p>
                    <p>2. Masuk ke dashboard untuk authoring, review, dan admin tools.</p>
                    <p>3. Kembali lagi ke public feed kapan saja tanpa logout.</p>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    className="rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white"
                    onClick={() => router.push("/dashboard")}
                  >
                    Open dashboard
                  </button>
                  <a
                    href="#blog"
                    className="rounded-2xl border border-stone-200 bg-white px-5 py-3 font-bold text-stone-700"
                  >
                    Read published stories
                  </a>
                </div>
                <p className="mt-4 text-sm text-slate-500">{message}</p>
              </section>
            ) : (
              <div id="auth" className="relative">
                <AuthScreen
                  mode={authMode}
                  name={name}
                  email={email}
                  password={password}
                  tenantSlug={tenantSlug}
                  message={message}
                  isLoading={isLoading}
                  onModeChange={setAuthMode}
                  onNameChange={setName}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onTenantSlugChange={setTenantSlug}
                  onSubmit={handleAuth}
                  variant="panel"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="intro" className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2.25rem] bg-stone-950 p-8 text-white shadow-xl shadow-stone-900/10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
              Section 1
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
              Intro
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-300">
              FlowForge Stories merangkai dua dunia yang biasanya terpisah: blog publik
              yang enak dibaca, dan editorial system yang tertib untuk tim internal.
              Hasilnya adalah landing page yang terasa hangat untuk pembaca, tapi tetap
              fungsional untuk author, editor, dan admin.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                Readers first
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                Clean public experience
              </h3>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                Hero yang jelas, navigasi sederhana, feed publik yang nyata, dan halaman
                detail artikel yang bisa dibuka langsung lewat slug.
              </p>
            </div>
            <div className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                Editors in control
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                Publish with governance
              </h3>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                Draft, submit, review, publish, dan unpublish tetap berada di dashboard
                tanpa membuat halaman publik terasa seperti panel admin.
              </p>
            </div>
            <div className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-sm md:col-span-2">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                    Public + private flow
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                    Navbar berubah sesuai status user, tapi halaman publik tetap bisa dinikmati sesudah login.
                  </h3>
                </div>
                <div className="rounded-[1.5rem] bg-amber-100 px-5 py-4 text-sm font-bold text-amber-950">
                  Guest untuk membaca, dashboard untuk bekerja.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="blog">
        <PublishedFeed
          posts={publishedPosts}
          title="Blog"
          description="Section 2 menampilkan published feed untuk pembaca publik maupun user yang sudah login. Setiap kartu bisa dibuka ke halaman detail artikel melalui slug."
        />
      </section>

      <section id="contact" className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.25rem] border border-stone-200 bg-white/90 p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Section 3
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
              Contact Us
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-stone-600">
              Punya pertanyaan editorial, ingin mengajukan kolaborasi, atau perlu akses
              ke workspace internal? Hubungi tim kami melalui kanal berikut.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.75rem] bg-stone-100 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                  Editorial desk
                </p>
                <p className="mt-3 text-lg font-semibold">editorial@flowforge.local</p>
                <p className="mt-2 text-sm leading-7 text-stone-600">
                  Untuk issue publikasi, review tulisan, dan kurasi artikel yang akan tayang.
                </p>
              </div>
              <div className="rounded-[1.75rem] bg-stone-100 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                  Admin support
                </p>
                <p className="mt-3 text-lg font-semibold">admin@flowforge.local</p>
                <p className="mt-2 text-sm leading-7 text-stone-600">
                  Untuk akses user, role editor, dan kebutuhan operasional platform.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[2.25rem] bg-stone-950 p-8 text-white shadow-xl shadow-stone-900/10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
              Say hello
            </p>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
              A platform for public reading, built with an editorial heartbeat.
            </h3>
            <p className="mt-5 text-sm leading-8 text-stone-300">
              Jika Anda sedang mengevaluasi pengalaman publik dan dashboard editorial
              dalam satu produk, landing page ini sekarang sudah mempresentasikan keduanya
              dengan lebih jelas: publik untuk membaca, internal untuk bekerja.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:editorial@flowforge.local"
                className="rounded-full bg-amber-300 px-5 py-3 text-sm font-bold text-stone-950"
              >
                Email editorial team
              </a>
              <a
                href="#hero"
                className="rounded-full border border-stone-700 px-5 py-3 text-sm font-bold text-white"
              >
                Back to top
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white/80 px-6 py-8 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-stone-950">FlowForge Stories</p>
            <p className="mt-1 text-sm text-stone-500">
              Public landing page, published feed, article detail, and editorial workspace in one flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-stone-600">
            <a href="#intro" className="hover:text-stone-950">
              Intro
            </a>
            <a href="#blog" className="hover:text-stone-950">
              Blog
            </a>
            <a href="#contact" className="hover:text-stone-950">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
