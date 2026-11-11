import { site } from "../data/site";
import { postHref, type Post } from "./posts";

type Feed = {
  title: string;
  description: string;
  /** Path of the page the feed belongs to, such as `/tech/`. */
  path: string;
  /** Path of the feed itself, such as `/tech/rss.xml`. */
  feedPath: string;
  posts: readonly Post[];
};

const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => entities[char]);
}

function absoluteUrl(path: string): string {
  const base = site.metadata.canonicalUrl;
  if (!base) throw new Error("RSS feeds require metadata.canonicalUrl.");
  return new URL(path, base).href;
}

function item(post: Post): string {
  const url = absoluteUrl(postHref(post));
  const categories =
    post.collection === "tech" ? post.data.tags : [post.data.kind];
  const lines = [
    `<title>${escapeXml(post.data.title)}</title>`,
    `<link>${url}</link>`,
    `<guid isPermaLink="true">${url}</guid>`,
    `<pubDate>${post.data.date.toUTCString()}</pubDate>`,
    `<description>${escapeXml(post.data.description)}</description>`,
    ...categories.map(
      (category) => `<category>${escapeXml(category)}</category>`,
    ),
  ];
  if (post.rendered?.html)
    lines.push(
      `<content:encoded>${escapeXml(post.rendered.html)}</content:encoded>`,
    );
  return `<item>\n      ${lines.join("\n      ")}\n    </item>`;
}

/** Builds an RSS 2.0 response containing each post's full text. */
export function rssResponse({
  title,
  description,
  path,
  feedPath,
  posts,
}: Feed): Response {
  const newest = posts[0]?.data;
  const lastBuild = newest ? (newest.updated ?? newest.date) : undefined;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${absoluteUrl(path)}</link>
    <description>${escapeXml(description)}</description>
    <language>en</language>
    <atom:link href="${absoluteUrl(feedPath)}" rel="self" type="application/rss+xml" />${
      lastBuild
        ? `\n    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`
        : ""
    }
    ${posts.map(item).join("\n    ")}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
