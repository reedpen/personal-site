import { z } from "astro/zod";

export const policySchema = z
  .object({
    owner: z
      .string()
      .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)
      .default("reedpen"),
    discover: z.enum(["pinned", "public", "none"]).default("pinned"),
    newProjects: z
      .object({
        site: z.boolean().default(false),
        resume: z.boolean().default(false),
      })
      .default({ site: false, resume: false }),
    includePrivate: z.boolean().default(false),
    model: z.string().trim().min(1).default("gpt-6.1-sol"),
    reasoningEffort: z
      .enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"])
      .default("medium"),
    maxBullets: z.number().int().min(1).max(10).default(3),
  })
  .strict();
