import type { APIRoute } from "astro";
import { site } from "../../data/site";
import { rssResponse } from "../../lib/feed";
import { blogFeed } from "../../lib/metadata";
import { publishedPosts } from "../../lib/posts";

export const GET: APIRoute = async () =>
  rssResponse({
    title: blogFeed("media").title,
    description: site.blogs.media.description,
    path: "/media/",
    feedPath: blogFeed("media").href,
    posts: await publishedPosts("media"),
  });
