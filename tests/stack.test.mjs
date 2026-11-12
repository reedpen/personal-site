import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stringify } from "yaml";
import {
  loadPortfolio,
  siteStack,
  resumeStack,
  uncategorizedTechnologies,
  stackFileSchema,
} from "../src/lib/portfolio.mjs";
import { prepareResumeData } from "../scripts/build-resume.mjs";
import { runProjects } from "../scripts/lib/projects.mjs";

const profile = {
  name: "Owner",
  location: "Utah",
  email: "owner@example.com",
  links: {
    website: "https://example.com",
    linkedin: "https://example.com/linkedin",
    github: "https://example.com/github",
  },
  education: [],
  experience: [],
  skills: [
    { label: "Languages", siteLabel: "languages", items: ["Python", "C"] },
    { label: "Frameworks/Libraries", items: ["React"] },
    { label: "Tools/Platforms", items: ["Postgres", "Git"] },
  ],
};
const generated = {
  repo: "owner/alpha",
  commit: "a".repeat(40),
  generatedAt: "2026-11-11T12:00:00Z",
  model: "old",
  summary: "Generated summary.",
  bullets: ["Generated bullet."],
  technologies: ["Generated"],
  pushedAt: "2026-11-11T12:00:00Z",
  private: false,
};
const project = (technologies, extra = {}) => ({
  title: "Example project",
  summary: "Owner summary.",
  site: true,
  technologies,
  ...extra,
});

function fixture(t, { stack, projects = {}, cached = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "stack-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const data = join(root, "src/data");
  const tempRoot = join(root, "tmp");
  mkdirSync(join(data, "projects"), { recursive: true });
  mkdirSync(tempRoot);
  const write = (file, value) =>
    writeFileSync(
      join(data, file),
      file.endsWith(".json") ? JSON.stringify(value) : stringify(value),
    );
  write("profile.yaml", profile);
  write("projects.config.yaml", {
    model: "test-model",
    reasoningEffort: "low",
  });
  write("projects.generated.json", { version: 1, projects: cached });
  if (stack !== undefined) write("stack.yaml", stack);
  for (const [slug, value] of Object.entries(projects))
    write(`projects/${slug}.yaml`, value);
  const logs = [];
  const calls = [];
  const options = {
    root,
    tempRoot,
    log: (line) => logs.push(line),
    runner: async (...args) => {
      calls.push(args);
      throw new Error("Unexpected process");
    },
  };
  return {
    root,
    data,
    tempRoot,
    write,
    logs,
    calls,
    options,
    load: () => loadPortfolio({ root }),
    source: () => readFileSync(join(data, "stack.yaml"), "utf8"),
    run: (args) => runProjects(args, options),
  };
}

function fakeClassifier(f, assignments) {
  f.options.runner = async (command, args) => {
    f.calls.push([command, args]);
    assert.equal(command, "codex");
    assert.deepEqual(args.slice(0, 7), [
      "exec",
      "-m",
      "test-model",
      "-c",
      "model_reasoning_effort=low",
      "-s",
      "read-only",
    ]);
    assert.ok(args.includes("--ephemeral"));
    assert.ok(args.includes("--skip-git-repo-check"));
    const directory = args[args.indexOf("-C") + 1];
    assert.equal(directory.startsWith(f.tempRoot), true);
    assert.deepEqual(readdirSync(directory).sort(), ["schema.json"]);
    const schema = JSON.parse(
      readFileSync(args[args.indexOf("--output-schema") + 1], "utf8"),
    );
    assert.deepEqual(
      schema.properties.assignments.items.properties.category.enum,
      [...profile.skills.map((skill) => skill.label), "hide"],
    );
    assert.match(args.at(-1), /Example project/);
    assert.match(args.at(-1), /Postgres/);
    await writeFile(
      args[args.indexOf("-o") + 1],
      JSON.stringify({ assignments }),
    );
    return { stdout: "" };
  };
}

test("missing policy exposes defaults, preserves owner skills and reports unfiled technologies", (t) => {
  const f = fixture(t, { projects: { alpha: project(["New"]) } });
  const p = f.load();
  assert.deepEqual(p.stack, {
    fromProjects: true,
    minProjects: 1,
    resume: false,
    aliases: {},
    hide: [],
    categories: {},
  });
  assert.deepEqual(siteStack(p), profile.skills);
  assert.deepEqual(uncategorizedTechnologies(p), [
    { name: "New", projects: ["alpha"] },
  ]);
});

test("owner order and metadata remain first; automatic items sort by distinct project counts then alphabetically", (t) => {
  const f = fixture(t, {
    stack: { categories: { Languages: ["Zulu", "alpha", "Beta"] } },
    projects: {
      a: project(["Zulu", "Zulu", "ALPHA", "Beta"]),
      b: project(["zulu"]),
    },
  });
  const p = f.load();
  const before = structuredClone(p);
  assert.deepEqual(siteStack(p)[0], {
    label: "Languages",
    siteLabel: "languages",
    items: ["Python", "C", "Zulu", "alpha", "Beta"],
  });
  assert.deepEqual(siteStack(p).slice(1), profile.skills.slice(1));
  assert.deepEqual(p, before);
  f.write("stack.yaml", {
    minProjects: 2,
    categories: { Languages: ["Zulu", "alpha", "Beta"] },
  });
  assert.deepEqual(siteStack(f.load())[0].items, ["Python", "C", "Zulu"]);
});

test("aliases and case dedupe owner items globally, retain owner spelling, and display alias targets or category spelling", (t) => {
  const f = fixture(t, {
    stack: {
      aliases: { " postgres ": "PostgreSQL", PG: "Postgres", Foo: "Canonical" },
      categories: {
        " tools/platforms ": ["postgresql", "CANONICAL", "CategoryCase"],
      },
    },
    projects: {
      a: project([
        " POSTGRESQL ",
        " pg ",
        "foo",
        "canonical",
        " categorycase ",
        "python",
        "REACT",
      ]),
    },
  });
  assert.deepEqual(siteStack(f.load())[2].items, [
    "Postgres",
    "Git",
    "Canonical",
    "CategoryCase",
  ]);
  assert.deepEqual(siteStack(f.load())[0].items, ["Python", "C"]);
  assert.deepEqual(uncategorizedTechnologies(f.load()), []);
});

test("hide never removes owner items; unfiled uses aliases and distinct site-visible project slugs", (t) => {
  const f = fixture(t, {
    stack: {
      aliases: { Variant: "Canonical" },
      hide: ["python", " Secret "],
      categories: { Languages: ["Java"] },
    },
    projects: {
      z: project(["PYTHON", "secret", "Variant", " canonical ", "Java"]),
      a: project(["Canonical"]),
      hidden: project(["Other", "Canonical", "Java"], {
        site: false,
        resume: true,
      }),
    },
  });
  assert.deepEqual(siteStack(f.load())[0].items, ["Python", "C", "Java"]);
  assert.deepEqual(uncategorizedTechnologies(f.load()), [
    { name: "Canonical", projects: ["a", "z"] },
  ]);
  f.write("stack.yaml", {
    minProjects: 2,
    categories: { Languages: ["Java"] },
  });
  assert.deepEqual(siteStack(f.load())[0].items, ["Python", "C"]);
});

test("stack uses merged technologies: manual arrays win, generated lists fill omissions, disabled generation is ignored", (t) => {
  const f = fixture(t, {
    stack: { categories: { Languages: ["Manual", "Generated"] } },
    projects: {
      manual: project(["Manual"]),
      empty: project([]),
      generated: project(undefined),
      disabled: project(undefined, { autoSummary: false }),
    },
    cached: {
      manual: generated,
      empty: generated,
      generated,
      disabled: generated,
    },
  });
  assert.deepEqual(siteStack(f.load())[0].items, [
    "Python",
    "C",
    "Generated",
    "Manual",
  ]);
});

test("résumé stays exactly on profile skills by default and opts into the same merged stack", (t) => {
  const f = fixture(t, {
    stack: { categories: { Languages: ["Java"] } },
    projects: { a: project(["Java"]) },
  });
  assert.deepEqual(resumeStack(f.load()), profile.skills);
  assert.deepEqual(prepareResumeData(f.load()).skills, profile.skills);
  f.write("stack.yaml", { resume: true, categories: { Languages: ["Java"] } });
  assert.deepEqual(resumeStack(f.load()), siteStack(f.load()));
  assert.deepEqual(prepareResumeData(f.load()).skills[0].items, [
    "Python",
    "C",
    "Java",
  ]);
  f.write("stack.yaml", {
    resume: true,
    fromProjects: false,
    categories: { Languages: ["Java"] },
  });
  assert.deepEqual(siteStack(f.load()), profile.skills);
  assert.deepEqual(resumeStack(f.load()), profile.skills);
});

test("policy errors identify file and field, including unknown labels and alias-normalized conflicts", (t) => {
  const f = fixture(t);
  for (const [stack, pattern] of [
    [{ fromProjects: "yes" }, /stack\.yaml: fromProjects:/],
    [{ minProjects: 0 }, /stack\.yaml: minProjects:/],
    [{ minProjects: 1.5 }, /stack\.yaml: minProjects:/],
    [{ resume: "yes" }, /stack\.yaml: resume:/],
    [{ aliases: { Foo: " " } }, /stack\.yaml: aliases.Foo:/],
    [
      { categories: { Invalid: [] } },
      /stack\.yaml: categories.Invalid:.*Valid labels: Languages/,
    ],
    [
      {
        aliases: { PG: "PostgreSQL" },
        categories: { Languages: ["pg"], "Tools/Platforms": [" POSTGRESQL "] },
      },
      /stack\.yaml: categories.Tools\/Platforms.0:.*also in category/,
    ],
    [
      {
        aliases: { PG: "PostgreSQL" },
        hide: ["pg"],
        categories: { "Tools/Platforms": ["postgresql"] },
      },
      /stack\.yaml: categories.Tools\/Platforms.0:.*also in hide/,
    ],
    [{ typo: true }, /stack\.yaml: \(root\):/],
  ]) {
    f.write("stack.yaml", stack);
    assert.throws(f.load, pattern);
  }
  assert.equal(stackFileSchema.safeParse({}).success, true);
});

test("CLI prints stack counts, unfiled project slugs and hidden technologies offline", async (t) => {
  const f = fixture(t, {
    stack: { categories: { Languages: ["Java"] }, hide: ["Secret"] },
    projects: { alpha: project(["Java", "Unfiled", "Secret"]) },
  });
  assert.equal(await f.run(["stack"]), 0);
  assert.match(f.logs.join("\n"), /Java \(auto, 1 project\)/);
  assert.match(f.logs.join("\n"), /Uncategorized:\n  Unfiled: alpha/);
  assert.match(f.logs.join("\n"), /Hidden \(auto-add only\):\n  Secret: alpha/);
  assert.equal(f.calls.length, 0);
});

test("CLI hide/show/add normalize, move items, preserve comments and reject unknown labels without writes", async (t) => {
  const f = fixture(t, { projects: { a: project(["Java"]) } });
  writeFileSync(
    join(f.data, "stack.yaml"),
    '# Owner heading\nresume: false # one page\naliases:\n  JDK: Java\ncategories:\n  Languages:\n    - "Java" # moved item\n    - "C" # keep item\n',
  );
  await f.run(["stack", "hide", " jdk ", "Secret"]);
  assert.deepEqual(f.load().stack.hide, ["Java", "Secret"]);
  await f.run(["stack", "show", "JAVA"]);
  assert.match(f.logs.join("\n"), /still uncategorized/);
  await f.run(["stack", "add", " tools/platforms ", "JDK", "secret"]);
  assert.deepEqual(f.load().stack.hide, []);
  assert.deepEqual(f.load().stack.categories["Tools/Platforms"], [
    "Java",
    "secret",
  ]);
  assert.deepEqual(f.load().stack.categories.Languages, ["C"]);
  assert.match(f.source(), /# Owner heading/);
  assert.match(f.source(), /resume: false # one page/);
  assert.match(f.source(), /"C" # keep item/);
  const before = f.source();
  await assert.rejects(
    f.run(["stack", "add", "Unknown", "Java"]),
    /Valid labels: Languages, Frameworks\/Libraries, Tools\/Platforms/,
  );
  for (const args of [["hide"], ["show"], ["classify", "--force"], ["wat"]])
    await assert.rejects(f.run(["stack", ...args]));
  assert.equal(f.source(), before);
  assert.equal(f.calls.length, 0);
  assert.ok(!readdirSync(f.data).some((file) => file.endsWith(".tmp")));
});

test("CLI creates missing policy; classify dry-run writes nothing and makes no calls", async (t) => {
  const f = fixture(t, { projects: { a: project(["Java"]) } });
  await f.run(["stack", "classify", "--dry-run"]);
  assert.ok(!readdirSync(f.data).includes("stack.yaml"));
  assert.equal(f.calls.length, 0);
  assert.match(f.logs.join("\n"), /Would classify Java/);
  await f.run(["stack", "hide", "Java"]);
  assert.deepEqual(f.load().stack.hide, ["Java"]);
});

test("CLI classify uses one isolated call, ignores extras, writes all assignments and cleans temp files", async (t) => {
  const f = fixture(t, { projects: { alpha: project(["Java", "Secret"]) } });
  fakeClassifier(f, [
    { technology: "JAVA", category: "Languages" },
    { technology: "Secret", category: "hide" },
    { technology: "Invented", category: "Unrequested category" },
  ]);
  assert.equal(await f.run(["stack", "classify"]), 0);
  assert.deepEqual(f.load().stack.categories, { Languages: ["Java"] });
  assert.deepEqual(f.load().stack.hide, ["Secret"]);
  assert.deepEqual(uncategorizedTechnologies(f.load()), []);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(readdirSync(f.tempRoot), []);
  assert.match(f.logs.join("\n"), /Java: filed under Languages/);
  await f.run(["stack", "classify"]);
  assert.equal(f.calls.length, 1);
});

test("CLI classify rejects incomplete, duplicate and invalid assignments atomically and cleans temps on failure", async (t) => {
  for (const assignments of [
    [],
    [{ technology: "Java", category: "Unknown" }],
    [
      { technology: "Java", category: "Languages" },
      { technology: "java", category: "hide" },
    ],
  ]) {
    const f = fixture(t, { stack: {}, projects: { alpha: project(["Java"]) } });
    const before = f.source();
    fakeClassifier(f, assignments);
    await assert.rejects(f.run(["stack", "classify"]));
    assert.equal(f.source(), before);
    assert.deepEqual(readdirSync(f.tempRoot), []);
  }
  const f = fixture(t, { projects: { a: project(["Java"]) } });
  f.options.runner = async () => {
    throw new Error("Fake Codex failure");
  };
  await assert.rejects(f.run(["stack", "classify"]), /Fake Codex failure/);
  assert.deepEqual(readdirSync(f.tempRoot), []);
  assert.ok(!readdirSync(f.data).includes("stack.yaml"));
});

test("refresh classifies only after a real successful refresh and retains summaries if classification fails", async (t) => {
  for (const failure of [false, true]) {
    const f = fixture(t, {
      projects: { alpha: project(undefined, { repo: "owner/alpha" }) },
    });
    let classifiers = 0;
    f.options.runner = async (command, args) => {
      if (command === "gh" && args[0] === "api")
        return {
          stdout: JSON.stringify(
            args[1].includes("/commits/")
              ? { sha: generated.commit }
              : {
                  private: false,
                  default_branch: "main",
                  pushed_at: generated.pushedAt,
                },
          ),
        };
      if (command === "gh") {
        mkdirSync(args[3]);
        return { stdout: "" };
      }
      if (command === "git") return { stdout: generated.commit };
      assert.equal(command, "codex");
      const schema = JSON.parse(
        readFileSync(args[args.indexOf("--output-schema") + 1], "utf8"),
      );
      if (schema.properties.assignments) {
        classifiers++;
        if (failure) throw new Error("Classifier unavailable");
      }
      await writeFile(
        args[args.indexOf("-o") + 1],
        JSON.stringify(
          schema.properties.assignments
            ? {
                assignments: [
                  { technology: "Generated", category: "Tools/Platforms" },
                ],
              }
            : {
                summary: generated.summary,
                bullets: generated.bullets,
                technologies: generated.technologies,
              },
        ),
      );
      return { stdout: "" };
    };
    assert.equal(await f.run(["refresh", "--dry-run"]), 0);
    assert.equal(classifiers, 0);
    assert.equal(await f.run(["refresh"]), failure ? 1 : 0);
    assert.equal(classifiers, 1);
    assert.equal(
      JSON.parse(readFileSync(join(f.data, "projects.generated.json"))).projects
        .alpha.summary,
      generated.summary,
    );
    if (failure)
      assert.match(
        f.logs.join("\n"),
        /Stack classification failed: Classifier unavailable/,
      );
    else
      assert.deepEqual(f.load().stack.categories, {
        "Tools/Platforms": ["Generated"],
      });
    assert.equal(await f.run(["refresh"]), 0);
    assert.equal(
      classifiers,
      1,
      "unchanged projects do not trigger classification",
    );
    assert.deepEqual(readdirSync(f.tempRoot), []);
  }
});
