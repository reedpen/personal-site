import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stringify } from "yaml";
import { buildResume, prepareResumeData } from "../scripts/build-resume.mjs";
import { loadPortfolio } from "../src/lib/portfolio.mjs";

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-resume-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function assertPdf(bytes) {
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.match(bytes.subarray(-100).toString(), /%%EOF/);
}

test("real portfolio produces a valid one-page PDF", async (t) => {
  const directory = await temporaryDirectory(t);
  const outFile = join(directory, "nested/resume.pdf");
  const { bytes, pages } = await buildResume({ outFile });
  assertPdf(bytes);
  assert.equal(pages, 1);
  assert.deepEqual(await readFile(outFile), bytes);
});

test("résumé data filters hidden entries and uses summaries only without bullets", () => {
  const portfolio = structuredClone(loadPortfolio());
  const included = portfolio.projects.find((project) => project.resume);
  const excluded = portfolio.projects.find((project) => !project.resume);
  assert.ok(included);
  assert.ok(excluded);
  included.bullets = [];
  included.summary = "Summary fallback";
  const withBullets = portfolio.projects.find(
    (project) => project.resume && project !== included,
  );
  withBullets.summary = "Must not appear with bullets";
  portfolio.profile.experience[0].resume = false;
  const before = structuredClone(portfolio);
  const prepared = prepareResumeData(portfolio);
  assert.deepEqual(
    prepared.projects.map((project) => project.title),
    portfolio.projects.filter((project) => project.resume).map((p) => p.title),
  );
  assert.ok(!prepared.projects.some((p) => p.title === excluded.title));
  assert.deepEqual(prepared.projects[0].bullets, ["Summary fallback"]);
  assert.deepEqual(
    prepared.projects.find((p) => p.title === withBullets.title).bullets,
    withBullets.bullets,
  );
  assert.deepEqual(
    prepared.experience,
    portfolio.profile.experience.filter((entry) => entry.resume),
  );
  assert.deepEqual(
    portfolio,
    before,
    "preparation must not mutate shared data",
  );
});

test("fixture text containing Typst syntax compiles as literal text", async (t) => {
  const root = await temporaryDirectory(t);
  const special = 'Literal # $ * _ @ < [ ] ~ \\ #panic("never evaluate")';
  const role = {
    title: special,
    organization: special,
    location: special,
    date: special,
    bullets: [special],
  };
  const profile = {
    name: special,
    location: special,
    email: "test@example.com",
    links: {
      website: "https://example.com/#special",
      linkedin: "https://example.com/_special",
      github: "https://example.com/@special",
    },
    education: [
      {
        institution: special,
        credential: special,
        date: special,
        roles: [role],
      },
    ],
    experience: [{ ...role, current: true, resume: true }],
    skills: [{ label: special, items: [special] }],
  };
  await mkdir(join(root, "src/data/projects"), { recursive: true });
  await writeFile(join(root, "src/data/profile.yaml"), stringify(profile));
  await writeFile(
    join(root, "src/data/projects.generated.json"),
    JSON.stringify({ version: 1, projects: {} }),
  );
  await writeFile(
    join(root, "src/data/projects/literal.yaml"),
    stringify({
      title: special,
      resume: true,
      url: "https://example.com/#literal",
      technologies: [special],
      summary: special,
      autoSummary: false,
    }),
  );
  const { bytes, pages } = await buildResume({ root });
  assertPdf(bytes);
  assert.equal(pages, 1);
});
