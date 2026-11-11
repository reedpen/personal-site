import type { APIRoute } from "astro";
import { site } from "../../data/site";
import { rssResponse } from "../../lib/feed";
import { blogFeed } from "../../lib/metadata";
import { publishedPosts } from "../../lib/posts";

export const GET: APIRoute = async () =>
  rssResponse({
    title: blogFeed("tech").title,
    description: site.blogs.tech.description,
    path: "/tech/",
    feedPath: blogFeed("tech").href,
    posts: await publishedPosts("tech"),
  });
