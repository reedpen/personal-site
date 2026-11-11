import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** Fields shared by every post in both blogs. */
const postFields = {
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  draft: z.boolean().default(false),
};

const tech = defineCollection({
  loader: glob({ base: "./src/content/tech", pattern: "**/*.md" }),
  schema: z.object({
    ...postFields,
    tags: z.array(z.string()).default([]),
  }),
});

const media = defineCollection({
  loader: glob({ base: "./src/content/media", pattern: "**/*.md" }),
  schema: z.object({
    ...postFields,
    kind: z.enum(["book", "movie"]),
    /** Author for a book, director for a movie. */
    creator: z.string(),
    /** Year the book or movie was released. */
    released: z.number().int().optional(),
    /** Whole-number rating out of five. */
    rating: z.number().int().min(1).max(5).optional(),
  }),
});

export const collections = { tech, media };
