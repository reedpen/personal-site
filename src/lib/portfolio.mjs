import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "astro/zod";

const text = z.string().trim().min(1);
const strings = z.array(text);
const repo = text.regex(
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
  "Expected owner/name",
);
const roleSchema = z.object({
  title: text,
  organization: text,
  location: text.optional(),
  date: text,
  bullets: strings,
});

export const profileSchema = z.object({
  name: text,
  location: text,
  email: z.string().email(),
  links: z.object({
    website: z.string().url(),
    linkedin: z.string().url(),
    github: z.string().url(),
  }),
  education: z.array(
    z.object({
      institution: text,
      credential: text,
      date: text,
      location: text.optional(),
      roles: z.array(roleSchema).optional(),
    }),
  ),
  experience: z.array(
    roleSchema.extend({
      current: z.boolean(),
      site: z.boolean().default(true),
      resume: z.boolean().default(true),
    }),
  ),
  skills: z.array(
    z.object({
      label: text,
      siteLabel: text.optional(),
      items: strings,
    }),
  ),
});

/** Canonicalize aliases transitively, retaining the final target's spelling.
 * @param {import("./portfolio.mjs").StackPolicy} stack
 * @param {string} name
 */
export function canonicalTechnology(stack, name) {
  const aliases = new Map(
    Object.entries(stack.aliases).map(([variant, target]) => [
      variant.trim().toLowerCase(),
      target,
    ]),
  );
  for (const target of Object.values(stack.aliases)) {
    if (!aliases.has(target.trim().toLowerCase()))
      aliases.set(target.trim().toLowerCase(), target.trim());
  }
  let result = name.trim();
  const seen = new Set();
  while (aliases.has(result.toLowerCase()) && !seen.has(result.toLowerCase())) {
    seen.add(result.toLowerCase());
    result = aliases.get(result.toLowerCase());
  }
  return result;
}

export const stackFileSchema = z
  .object({
    fromProjects: z.boolean().default(true),
    minProjects: z.number().int().min(1).default(1),
    resume: z.boolean().default(false),
    aliases: z.record(text, text).default({}),
    hide: strings.default([]),
    categories: z.record(text, strings).default({}),
  })
  .strict()
  .superRefine((stack, ctx) => {
    const key = (name) => canonicalTechnology(stack, name).toLowerCase();
    const hidden = new Set(stack.hide.map(key));
    const filed = new Map();
    for (const [label, items] of Object.entries(stack.categories)) {
      for (const [index, item] of items.entries()) {
        const normalized = key(item);
        if (hidden.has(normalized))
          ctx.addIssue({
            code: "custom",
            path: ["categories", label, index],
            message: `${item} is also in hide`,
          });
        if (filed.has(normalized) && filed.get(normalized) !== label)
          ctx.addIssue({
            code: "custom",
            path: ["categories", label, index],
            message: `${item} is also in category ${filed.get(normalized)}`,
          });
        filed.set(normalized, label);
      }
    }
  });

export const projectFileSchema = z.object({
  title: text,
  repo: repo.optional(),
  url: z.string().url().optional(),
  site: z.boolean().default(false),
  resume: z.boolean().default(false),
  order: z.number().finite().optional(),
  technologies: strings.optional(),
  summary: text.optional(),
  bullets: strings.optional(),
  autoSummary: z.boolean().default(true),
  allowPrivate: z.boolean().default(false),
});

export const generatedFileSchema = z.object({
  version: z.literal(1),
  projects: z.record(
    z.string(),
    z.object({
      repo,
      commit: text,
      generatedAt: z.string().datetime({ offset: true }),
      model: text,
      summary: text,
      bullets: strings,
      technologies: strings,
      pushedAt: z.string().datetime({ offset: true }),
      private: z.boolean(),
    }),
  ),
});

/** Read and validate one file, retaining its path and failing field in errors.
 * @template T
 * @param {string} file
 * @param {{parse(value: unknown): T}} schema
 * @param {(source: string) => unknown} decode
 * @returns {T}
 */
function read(file, schema, decode) {
  try {
    return schema.parse(decode(readFileSync(file, "utf8")));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `${file}: ${error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")}`,
        { cause: error },
      );
    }
    throw new Error(
      `${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/** Load shared professional data without depending on the caller's working directory.
 * Manual fields (including empty lists) take precedence over generated fields.
 * @param {{root?: string}} [options]
 * @returns {import("./portfolio.mjs").Portfolio}
 */
export function loadPortfolio(options = {}) {
  const root = options.root ?? new URL("../../", import.meta.url).href;
  const data = join(
    root.startsWith("file:") ? fileURLToPath(root) : root,
    "src/data",
  );
  const profile = read(join(data, "profile.yaml"), profileSchema, parse);
  const stackFile = join(data, "stack.yaml");
  const stack = existsSync(stackFile)
    ? read(stackFile, stackFileSchema, parse)
    : stackFileSchema.parse({});
  const labels = new Set(
    profile.skills.map((skill) => skill.label.toLowerCase()),
  );
  for (const label of Object.keys(stack.categories)) {
    if (!labels.has(label.toLowerCase()))
      throw new Error(
        `${stackFile}: categories.${label}: unknown profile skill label. Valid labels: ${profile.skills.map((skill) => skill.label).join(", ")}`,
      );
  }
  const generated = read(
    join(data, "projects.generated.json"),
    generatedFileSchema,
    JSON.parse,
  );
  const directory = join(data, "projects");
  const projects = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => {
      const file = join(directory, entry.name);
      const slug = entry.name.slice(0, -5);
      const manual = read(file, projectFileSchema, parse);
      const cached = generated.projects[slug];
      let usedGenerated = false;
      /** @param {"summary" | "bullets" | "technologies"} field */
      const merged = (field) => {
        if (manual[field] !== undefined) return manual[field];
        if (manual.autoSummary && cached?.[field] !== undefined) {
          usedGenerated = true;
          return cached[field];
        }
        return undefined;
      };
      const summary = /** @type {string | undefined} */ (merged("summary"));
      const bullets = /** @type {string[]} */ (merged("bullets") ?? []);
      const technologies = /** @type {string[]} */ (
        merged("technologies") ?? []
      );
      if ((manual.site || manual.resume) && !summary && bullets.length === 0) {
        throw new Error(
          `${file}: ${slug}.summary: add a summary or bullets, or run the refresh script`,
        );
      }
      return {
        slug,
        title: manual.title,
        repo: manual.repo,
        url:
          manual.url ??
          (manual.repo ? `https://github.com/${manual.repo}` : undefined),
        site: manual.site,
        resume: manual.resume,
        order: manual.order ?? Number.POSITIVE_INFINITY,
        technologies,
        summary,
        bullets,
        updatedAt: cached?.pushedAt,
        generated: usedGenerated,
      };
    });
  projects.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return { profile, projects, stack };
}

/** @param {import("./portfolio.mjs").Portfolio} p */
export const siteProjects = (p) => p.projects.filter((project) => project.site);
/** @param {import("./portfolio.mjs").Portfolio} p */
export const resumeProjects = (p) =>
  p.projects.filter((project) => project.resume);
/** @param {import("./portfolio.mjs").Portfolio} p */
export const siteExperience = (p) =>
  p.profile.experience.filter((entry) => entry.site);
/** @param {import("./portfolio.mjs").Portfolio} p */
export const resumeExperience = (p) =>
  p.profile.experience.filter((entry) => entry.resume);

/** Canonical technologies and distinct site-visible projects, independent of policy switches.
 * @param {import("./portfolio.mjs").Portfolio} p
 * @returns {{name: string, projects: string[]}[]}
 */
export function stackTechnologies(p) {
  const canonical = (name) => canonicalTechnology(p.stack, name);
  const spellings = new Map();
  // Owner spelling wins; otherwise use alias targets or category spelling.
  for (const skill of p.profile.skills) {
    for (const name of skill.items) {
      const normalized = canonical(name).toLowerCase();
      if (!spellings.has(normalized)) spellings.set(normalized, name);
    }
  }
  for (const name of Object.values(p.stack.categories).flat()) {
    const normalized = canonical(name).toLowerCase();
    if (!spellings.has(normalized)) spellings.set(normalized, canonical(name));
  }
  const usage = new Map();
  for (const project of siteProjects(p)) {
    for (const technology of project.technologies) {
      const name = canonical(technology);
      const key = name.toLowerCase();
      if (!usage.has(key))
        usage.set(key, {
          name: spellings.get(key) ?? name,
          projects: new Set(),
        });
      usage.get(key).projects.add(project.slug);
    }
  }
  return [...usage.values()]
    .map(({ name, projects }) => ({ name, projects: [...projects].sort() }))
    .sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "en"),
    );
}

/** @param {import("./portfolio.mjs").Portfolio} p
 * @returns {import("./portfolio.mjs").Skill[]}
 */
export function siteStack(p) {
  const skills = p.profile.skills.map((skill) => ({
    ...skill,
    items: [...skill.items],
  }));
  if (!p.stack.fromProjects) return skills;
  const key = (name) => canonicalTechnology(p.stack, name).toLowerCase();
  const present = new Set(skills.flatMap((skill) => skill.items).map(key));
  const hidden = new Set(p.stack.hide.map(key));
  const usage = stackTechnologies(p).sort(
    (a, b) =>
      b.projects.length - a.projects.length ||
      a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "en"),
  );
  for (const skill of skills) {
    const categorized = new Set(
      Object.entries(p.stack.categories)
        .filter(([label]) => label.toLowerCase() === skill.label.toLowerCase())
        .flatMap(([, items]) => items)
        .map(key),
    );
    for (const technology of usage) {
      const normalized = key(technology.name);
      if (
        technology.projects.length < p.stack.minProjects ||
        hidden.has(normalized) ||
        present.has(normalized) ||
        !categorized.has(normalized)
      )
        continue;
      skill.items.push(technology.name);
      present.add(normalized);
    }
  }
  return skills;
}

/** @param {import("./portfolio.mjs").Portfolio} p
 * @returns {import("./portfolio.mjs").Skill[]}
 */
export const resumeStack = (p) =>
  p.stack.resume
    ? siteStack(p)
    : p.profile.skills.map((skill) => ({ ...skill, items: [...skill.items] }));

/** Unfiled technologies remain visible for review even below minProjects or with fromProjects off.
 * @param {import("./portfolio.mjs").Portfolio} p
 */
export function uncategorizedTechnologies(p) {
  const key = (name) => canonicalTechnology(p.stack, name).toLowerCase();
  const known = new Set(
    [
      ...p.profile.skills.flatMap((skill) => skill.items),
      ...Object.values(p.stack.categories).flat(),
      ...p.stack.hide,
    ].map(key),
  );
  return stackTechnologies(p).filter(({ name }) => !known.has(key(name)));
}
