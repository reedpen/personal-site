import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import test from "node:test";
import { stringify } from "yaml";
import {
  loadPortfolio,
  siteProjects,
  resumeProjects,
  siteExperience,
  resumeExperience,
  projectFileSchema,
  generatedFileSchema,
  profileSchema,
} from "../src/lib/portfolio.mjs";

const profile = {
  name: "Example Owner",
  location: "Provo, UT",
  email: "owner@example.com",
  links: {
    website: "https://example.com",
    linkedin: "https://linkedin.com/in/example",
    github: "https://github.com/example",
  },
  education: [],
  experience: [
    {
      title: "Default",
      organization: "Org",
      date: "2026",
      current: true,
      bullets: ["Work."],
    },
    {
      title: "Site",
      organization: "Org",
      date: "2026",
      current: false,
      bullets: ["Work."],
      resume: false,
    },
    {
      title: "Resume",
      organization: "Org",
      date: "2026",
      current: false,
      bullets: ["Work."],
      site: false,
    },
  ],
  skills: [],
};
const generated = {
  repo: "example/project",
  commit: "abc123",
  generatedAt: "2026-11-11T12:00:00Z",
  model: "example-model",
  summary: "Generated summary.",
  bullets: ["Generated bullet."],
  technologies: ["JavaScript"],
  pushedAt: "2026-11-10T12:00:00Z",
  private: false,
};

function fixture(t, projects = {}, cached = {}) {
  const root = mkdtempSync(join(tmpdir(), "portfolio-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const data = join(root, "src/data");
  mkdirSync(join(data, "projects"), { recursive: true });
  const write = (file, value) =>
    writeFileSync(
      join(data, file),
      file.endsWith(".json") ? JSON.stringify(value) : stringify(value),
    );
  write("profile.yaml", profile);
  write("projects.generated.json", { version: 1, projects: cached });
  for (const [slug, project] of Object.entries(projects))
    write(`projects/${slug}.yaml`, project);
  return { root, load: () => loadPortfolio({ root }), write };
}

test("manual fields win independently, including empty arrays", (t) => {
  const { load } = fixture(
    t,
    {
      manual: {
        title: "Manual",
        site: true,
        summary: "Owner text.",
        bullets: [],
        technologies: ["Python"],
      },
      partial: { title: "Partial", summary: "Owner summary." },
      automatic: { title: "Automatic", site: true },
    },
    { manual: generated, partial: generated, automatic: generated },
  );
  const p = load();
  const manual = p.projects.find((p) => p.slug === "manual");
  assert.equal(manual.summary, "Owner text.");
  assert.deepEqual(manual.bullets, []);
  assert.deepEqual(manual.technologies, ["Python"]);
  assert.equal(manual.generated, false);
  assert.equal(manual.updatedAt, generated.pushedAt);
  const partial = p.projects.find((p) => p.slug === "partial");
  assert.equal(partial.summary, "Owner summary.");
  assert.deepEqual(partial.bullets, generated.bullets);
  assert.equal(partial.generated, true);
  const automatic = p.projects.find((p) => p.slug === "automatic");
  assert.equal(automatic.summary, generated.summary);
  assert.deepEqual(automatic.technologies, generated.technologies);
  assert.equal(automatic.generated, true);
});

test("autoSummary false ignores generated text", (t) => {
  const { load } = fixture(
    t,
    { disabled: { title: "Disabled", autoSummary: false } },
    { disabled: generated },
  );
  const [project] = load().projects;
  assert.equal(project.summary, undefined);
  assert.deepEqual(project.bullets, []);
  assert.deepEqual(project.technologies, []);
  assert.equal(project.generated, false);
});

test("URLs default to GitHub and explicit URLs take precedence", (t) => {
  const { load } = fixture(t, {
    repo: { title: "Repo", repo: "owner/name" },
    explicit: {
      title: "Explicit",
      repo: "owner/name",
      url: "https://example.com/project",
    },
    none: { title: "None" },
  });
  const bySlug = Object.fromEntries(load().projects.map((p) => [p.slug, p]));
  assert.equal(bySlug.repo.url, "https://github.com/owner/name");
  assert.equal(bySlug.explicit.url, "https://example.com/project");
  assert.equal(bySlug.none.url, undefined);
});

test("site and resume switches filter independently with documented defaults", (t) => {
  const { load } = fixture(t, {
    hidden: { title: "Hidden" },
    site: { title: "Site", summary: "Site.", site: true },
    resume: { title: "Resume", summary: "Resume.", resume: true },
    both: { title: "Both", summary: "Both.", site: true, resume: true },
  });
  const p = load();
  assert.deepEqual(
    siteProjects(p).map((p) => p.slug),
    ["both", "site"],
  );
  assert.deepEqual(
    resumeProjects(p).map((p) => p.slug),
    ["both", "resume"],
  );
  assert.deepEqual(
    siteExperience(p).map((e) => e.title),
    ["Default", "Site"],
  );
  assert.deepEqual(
    resumeExperience(p).map((e) => e.title),
    ["Default", "Resume"],
  );
});

test("sorts by order, breaks ties by title, and puts omitted order last", (t) => {
  const { load } = fixture(t, {
    z: { title: "Zulu", order: 2 },
    b: { title: "Beta", order: 2 },
    a: { title: "Alpha" },
    first: { title: "First", order: -1 },
    last: { title: "Last" },
  });
  assert.deepEqual(
    load().projects.map((p) => p.slug),
    ["first", "b", "z", "a", "last"],
  );
});

test("validation identifies the project file and field", (t) => {
  const { load } = fixture(t, { broken: { title: "Broken", site: "yes" } });
  assert.throws(load, /broken\.yaml: site:/);
});

test("enabled projects need a summary or bullets even with autoSummary disabled", (t) => {
  for (const visibility of [{ site: true }, { resume: true }]) {
    const { load } = fixture(
      t,
      { missing: { title: "Missing", autoSummary: false, ...visibility } },
      { missing: generated },
    );
    assert.throws(
      load,
      /missing\.yaml: missing\.summary: add a summary or bullets, or run the refresh script/,
    );
  }
});

test("bullets alone are enough text for an enabled project", (t) => {
  const { load } = fixture(t, {
    lead: {
      title: "Lead",
      site: true,
      resume: true,
      bullets: ["First.", "Second."],
    },
  });
  const [project] = load().projects;
  assert.equal(project.summary, undefined);
  assert.deepEqual(project.bullets, ["First.", "Second."]);
});

test("profile and generated validation errors identify the file and nested field", (t) => {
  const f = fixture(t);
  f.write("profile.yaml", {
    ...profile,
    links: { ...profile.links, github: "invalid" },
  });
  assert.throws(f.load, /profile\.yaml: links.github:/);
  f.write("profile.yaml", profile);
  f.write("projects.generated.json", {
    version: 1,
    projects: { bad: { ...generated, pushedAt: "yesterday" } },
  });
  assert.throws(f.load, /projects\.generated\.json: projects.bad.pushedAt:/);
});

test("parse and read failures retain the offending file name", (t) => {
  const { load, write } = fixture(t);
  write("projects.generated.json", { version: 2, projects: {} });
  assert.throws(load, /projects\.generated\.json: version:/);
  write("projects.generated.json", { version: 1, projects: {} });
  write("projects/broken.yaml", { summary: "Missing title" });
  assert.throws(load, /broken\.yaml: title:/);
});

test("schemas are exported for future writers", () => {
  assert.equal(profileSchema.safeParse(profile).success, true);
  assert.equal(
    generatedFileSchema.safeParse({
      version: 1,
      projects: { example: generated },
    }).success,
    true,
  );
  assert.equal(
    projectFileSchema.parse({ title: "Defaults" }).autoSummary,
    true,
  );
});

test("accepts a file URL root supplied by Astro", (t) => {
  const { root } = fixture(t);
  assert.equal(
    loadPortfolio({ root: pathToFileURL(root).href }).profile.name,
    profile.name,
  );
});
