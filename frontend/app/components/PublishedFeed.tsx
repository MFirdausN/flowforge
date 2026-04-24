import Link from "next/link";
import { formatDate } from "../lib/format";
import type { BlogPost } from "../lib/types";

export function PublishedFeed({
  posts,
  title = "Published stories",
  description = "Tulisan yang sudah lolos editorial dan siap dibaca publik.",
}: {
  posts: BlogPost[];
  title?: string;
  description?: string;
}) {
  return (
    <section className="bg-stone-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="motion-fade flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
              Public feed
            </p>
            <h2 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{title}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-stone-300">{description}</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.id}
              className="surface-panel hover-lift motion-fade rounded-[2rem] border border-stone-800 bg-white/5 p-6 backdrop-blur"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-stone-950">
                  {post.author.role}
                </span>
                <span className="text-xs uppercase tracking-[0.16em] text-stone-400">
                  {formatDate(post.publishedAt ?? post.createdAt)}
                </span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{post.title}</h3>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                {post.excerpt || `${post.content.slice(0, 180)}...`}
              </p>
              <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-white/6 p-4 text-sm text-stone-200 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{post.author.name}</p>
                  <p className="mt-1 text-stone-400">/{post.slug}</p>
                  {post.tenant && (
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                      {post.tenant.name}
                    </p>
                  )}
                </div>
                <Link
                  href={`/posts/${post.slug}`}
                  className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-950"
                >
                  Read story
                </Link>
              </div>
            </article>
          ))}
        </div>
        {posts.length === 0 && (
          <div className="mt-10 rounded-[2rem] border border-dashed border-stone-700 p-10 text-center text-stone-300">
            Belum ada posting publik. Publish satu tulisan dari dashboard editor atau admin.
          </div>
        )}
      </div>
    </section>
  );
}
