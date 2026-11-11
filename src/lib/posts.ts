import { getCollection, type CollectionEntry } from "astro:content";

export type BlogName = "tech" | "media";
export type Post<B extends BlogName = BlogName> = CollectionEntry<B>;

export const blogNames = [
  "tech",
  "media",
] as const satisfies readonly BlogName[];

/**
 * Posts newest first. Drafts appear in `pnpm dev` and are omitted from
 * production builds.
 */
export async function publishedPosts<B extends BlogName>(
  blog: B,
): Promise<Post<B>[]> {
  const posts = (await getCollection(
    blog,
    ({ data }) => import.meta.env.DEV || !data.draft,
  )) as Post<B>[];
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function postHref(post: Post): string {
  return `/${post.collection}/${post.id}/`;
}

/** Formats a date as YYYY-MM-DD, independent of the build machine's zone. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
