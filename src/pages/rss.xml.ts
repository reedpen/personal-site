import type { APIRoute } from "astro";
import { site } from "../data/site";
import { rssResponse } from "../lib/feed";
import { blogNames, publishedPosts } from "../lib/posts";

/** Every published post from both blogs, newest first. */
export const GET: APIRoute = async () => {
  const posts = (
    await Promise.all(blogNames.map((blog) => publishedPosts(blog)))
  )
    .flat()
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rssResponse({
    title: site.feed.title,
    description: site.feed.description,
    path: "/",
    feedPath: "/rss.xml",
    posts,
  });
};
