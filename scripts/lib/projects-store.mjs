import { readFile, readdir, writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { parseDocument } from "yaml";
import {
  projectFileSchema,
  generatedFileSchema,
} from "../../src/lib/portfolio.mjs";
import { policySchema } from "./projects-config.mjs";

export async function readYaml(file, schema) {
  try {
    const doc = parseDocument(await readFile(file, "utf8"));
    if (doc.errors.length) throw doc.errors[0];
    return { doc, value: schema.parse(doc.toJS()) };
  } catch (error) {
    throw new Error(`${file}: ${error.message}`, { cause: error });
  }
}

export async function readStore(root) {
  const data = join(root, "src/data");
  const directory = join(data, "projects");
  const names = (await readdir(directory))
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  const projects = await Promise.all(
    names.map(async (name) => ({
      slug: name.slice(0, -5),
      file: join(directory, name),
      ...(await readYaml(join(directory, name), projectFileSchema)),
    })),
  );
  const generatedFile = join(data, "projects.generated.json");
  let generated;
  try {
    generated = generatedFileSchema.parse(
      JSON.parse(await readFile(generatedFile, "utf8")),
    );
  } catch (error) {
    throw new Error(`${generatedFile}: ${error.message}`, { cause: error });
  }
  return { data, directory, projects, generatedFile, generated };
}

export async function readPolicy(data) {
  return (await readYaml(join(data, "projects.config.yaml"), policySchema))
    .value;
}

export function selectProjects(projects, slugs) {
  const unknown = slugs.filter(
    (slug) => !projects.some((p) => p.slug === slug),
  );
  if (unknown.length)
    throw new Error(
      `Unknown project(s): ${unknown.join(", ")}. Valid slugs: ${projects.map((p) => p.slug).join(", ")}`,
    );
  return slugs.length
    ? projects.filter((p) => slugs.includes(p.slug))
    : projects;
}

export async function writeGenerated(file, generated) {
  const sorted = {
    version: 1,
    projects: Object.fromEntries(
      Object.entries(generated.projects).sort(([a], [b]) =>
        a.localeCompare(b, "en"),
      ),
    ),
  };
  generatedFileSchema.parse(sorted);
  await writeAtomic(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

export async function writeAtomic(file, source) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, source, {
      flag: "wx",
    });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function effectiveText(project, cached) {
  const generated = project.autoSummary ? cached : undefined;
  return {
    summary: project.summary ?? generated?.summary,
    bullets: project.bullets ?? generated?.bullets ?? [],
  };
}
