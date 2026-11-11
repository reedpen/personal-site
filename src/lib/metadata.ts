import { site, type SiteMetadata } from "../data/site";
import type { BlogName } from "./posts";

/** Metadata for a page other than the home page. */
export function pageMetadata(
  title: string,
  description: string,
  path: string,
): SiteMetadata {
  const metadata: SiteMetadata = site.metadata;
  const { author, canonicalUrl, socialImage } = metadata;
  return {
    title: `${title} — ${author}`,
    description,
    author,
    socialImage,
    canonicalUrl: canonicalUrl ? new URL(path, canonicalUrl).href : undefined,
  };
}

/** The RSS feed for one blog. */
export function blogFeed(blog: BlogName): { title: string; href: string } {
  return {
    title: `${site.metadata.author} — ${site.blogs[blog].title}`,
    href: `/${blog}/rss.xml`,
  };
}
