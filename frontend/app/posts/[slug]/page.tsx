"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicNavbar } from "../../components/PublicNavbar";
import { API_BASE_URL } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { readSession } from "../../lib/session";
import type { ApiUser, BlogPost } from "../../lib/types";

export default function PublicPostDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = readSession();
    if (session) {
      setUser(session.user);
    }
  }, []);

  useEffect(() => {
    async function loadPost() {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/posts/published/${params.slug}`, {
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error("Post not found");
        }

        const data = (await response.json()) as BlogPost;
        setPost(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load post");
      } finally {
        setIsLoading(false);
      }
    }

    if (params.slug) {
      void loadPost();
    }
  }, [params.slug]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf6ea_0%,#f1ece1_38%,#f7f3eb_100%)] text-stone-950">
      <PublicNavbar
        user={user}
        onLogout={() => {
          setUser(null);
          router.push("/");
        }}
      />

      <section className="px-5 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700"
          >
            Back to published feed
          </Link>

          {isLoading && (
            <div className="mt-8 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
              Loading story...
            </div>
          )}

          {!isLoading && error && (
            <div className="mt-8 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
              <h1 className="text-2xl font-semibold">Story not found</h1>
              <p className="mt-3 text-sm text-stone-600">{error}</p>
            </div>
          )}

          {!isLoading && post && (
            <article className="surface-panel motion-fade mt-8 rounded-[2.5rem] border border-stone-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-8 md:p-12">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-amber-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-950">
                  {post.author.role}
                </span>
                <span className="text-sm text-stone-500">
                  Published {formatDate(post.publishedAt ?? post.createdAt)}
                </span>
              </div>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.05em] md:text-6xl">
                {post.title}
              </h1>
              <div className="mt-6 rounded-[1.75rem] bg-stone-100 p-5">
                <p className="text-sm font-bold text-stone-900">{post.author.name}</p>
                <p className="mt-1 text-sm text-stone-500">/{post.slug}</p>
                {post.tenant && (
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                    {post.tenant.name}
                  </p>
                )}
                {post.excerpt && (
                  <p className="mt-4 text-base leading-8 text-stone-700">{post.excerpt}</p>
                )}
              </div>
              <div className="prose prose-stone mt-8 max-w-none whitespace-pre-wrap text-base leading-8 text-stone-700">
                {post.content}
              </div>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
