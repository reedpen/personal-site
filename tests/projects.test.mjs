import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { runProjects } from "../scripts/lib/projects.mjs";
import { policySchema } from "../scripts/lib/projects-config.mjs";
import { outputSchema } from "../scripts/lib/projects-prompt.mjs";

const sha = "a".repeat(40);
const date = "2026-11-11T12:00:00.000Z";
const text = {
  summary: "A command-line tool that tracks changes.",
  bullets: ["Implemented change tracking with SQLite transactions."],
  technologies: ["JavaScript", "SQLite"],
};
const cached = {
  repo: "reedpen/alpha",
  commit: sha,
  generatedAt: date,
  model: "old-model",
  ...text,
  pushedAt: date,
  private: false,
};
const profile = {
  name: "Owner",
  location: "Utah",
  email: "owner@example.com",
  links: {
    website: "https://example.com",
    linkedin: "https://linkedin.com/in/owner",
    github: "https://github.com/reedpen",
  },
  education: [],
  experience: [],
  skills: [],
};

async function fixture(
  t,
  projects = { alpha: { title: "Alpha", repo: "reedpen/alpha" } },
  entries = {},
  policy = {},
) {
  const root = await mkdtemp(join(tmpdir(), "projects-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const data = join(root, "src/data");
  const tempRoot = join(root, "tmp");
  await mkdir(join(data, "projects"), { recursive: true });
  await mkdir(tempRoot);
  await writeFile(join(data, "profile.yaml"), stringify(profile));
  await writeFile(
    join(data, "projects.config.yaml"),
    stringify(policySchema.parse(policy)),
  );
  await writeFile(
    join(data, "projects.generated.json"),
    `${JSON.stringify({ version: 1, projects: entries }, null, 2)}\n`,
  );
  for (const [slug, project] of Object.entries(projects))
    await writeFile(join(data, "projects", `${slug}.yaml`), stringify(project));
  const logs = [];
  const calls = [];
  const options = {
    root,
    tempRoot,
    log: (line) => logs.push(line),
    now: () => new Date(date),
    runner: async (...args) => {
      calls.push(args);
      throw new Error("Unexpected external process");
    },
  };
  return {
    root,
    data,
    tempRoot,
    logs,
    calls,
    options,
    run: (args) => runProjects(args, options),
    readProject: async (slug) =>
      parse(await readFile(join(data, "projects", `${slug}.yaml`), "utf8")),
    readGenerated: async () =>
      JSON.parse(await readFile(join(data, "projects.generated.json"), "utf8")),
  };
}

function fakeRefresh(
  f,
  {
    privateRepos = [],
    failures = [],
    invalid = [],
    moved = [],
    delay = false,
  } = {},
) {
  let active = 0;
  let maxActive = 0;
  const clones = new Map();
  f.options.runner = async (command, args) => {
    f.calls.push([command, args]);
    if (command === "gh" && args[0] === "api") {
      const repo = args[1].split("/").slice(1, 3).join("/");
      if (failures.includes(repo)) throw new Error("Fake GitHub failure");
      return {
        stdout: JSON.stringify(
          args[1].includes("/commits/")
            ? { sha }
            : {
                private: privateRepos.includes(repo),
                default_branch: "main",
                pushed_at: date,
              },
        ),
      };
    }
    if (command === "gh" && args[0] === "repo") {
      assert.deepEqual(args.slice(4), [
        "--",
        "--depth",
        "1",
        "--branch",
        "main",
      ]);
      await mkdir(args[3]);
      clones.set(args[3], args[2]);
      return { stdout: "" };
    }
    if (command === "git")
      return {
        stdout: `${moved.includes(clones.get(args[1])) ? "b".repeat(40) : sha}\n`,
      };
    if (command === "codex") {
      const repo = clones.get(args[args.indexOf("-C") + 1]);
      active++;
      maxActive = Math.max(active, maxActive);
      try {
        if (delay) await new Promise((resolve) => setTimeout(resolve, 20));
        await writeFile(
          args[args.indexOf("-o") + 1],
          JSON.stringify(
            invalid.includes(repo) ? { ...text, surprise: "invalid" } : text,
          ),
        );
        return { stdout: "" };
      } finally {
        active--;
      }
    }
    throw new Error(`Unexpected command ${command}`);
  };
  return { maxActive: () => maxActive };
}

async function snapshot(directory) {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    result[entry.name] = entry.isDirectory()
      ? await snapshot(path)
      : await readFile(path, "utf8");
  }
  return result;
}

test("toggles preserve owner comments and scalar formatting", async (t) => {
  const f = await fixture(t);
  const file = join(f.data, "projects/alpha.yaml");
  await writeFile(
    file,
    '# Keep this heading\ntitle: "Alpha" # title note\nrepo: reedpen/alpha\nsite: false # visibility note\nresume: false\nautoSummary: true\nbullets: [] # intentional\n',
  );
  for (const args of [
    ["public", "alpha"],
    ["resume", "on", "alpha"],
    ["auto", "off", "alpha"],
  ])
    assert.equal(await f.run(args), 0);
  const source = await readFile(file, "utf8");
  assert.match(source, /# Keep this heading/);
  assert.match(source, /title: "Alpha" # title note/);
  assert.match(source, /site: true # visibility note/);
  assert.match(source, /bullets: \[\] # intentional/);
  assert.deepEqual(await f.readProject("alpha"), {
    title: "Alpha",
    repo: "reedpen/alpha",
    site: true,
    resume: true,
    autoSummary: false,
    bullets: [],
  });
  await f.run(["hide", "alpha"]);
  await f.run(["resume", "off", "alpha"]);
  await f.run(["auto", "on", "alpha"]);
  assert.equal((await f.readProject("alpha")).site, false);
  assert.equal(f.calls.length, 0);
});

test("unknown slugs list valid names and do not partially toggle", async (t) => {
  const f = await fixture(t);
  const before = await snapshot(f.data);
  await assert.rejects(
    f.run(["public", "alpha", "missing"]),
    /Unknown project\(s\): missing. Valid slugs: alpha/,
  );
  await assert.rejects(f.run(["refresh", "missing"]), /Valid slugs: alpha/);
  assert.deepEqual(await snapshot(f.data), before);
});

test("list and help work offline with manual, generated, mixed and missing text", async (t) => {
  const f = await fixture(
    t,
    {
      alpha: { title: "Alpha", summary: "Owner text." },
      beta: { title: "Beta", summary: "Manual partial." },
      gamma: { title: "Gamma" },
      missing: { title: "Missing" },
    },
    { beta: cached, gamma: cached },
  );
  assert.equal(await f.run(["list"]), 0);
  assert.match(f.logs.join("\n"), /manual\+generated/);
  assert.match(f.logs.join("\n"), /aaaaaaaa/);
  assert.match(f.logs.join("\n"), /missing/);
  assert.equal(await f.run(["help"]), 0);
  assert.equal(f.calls.length, 0);
});

test("pinned discovery skips tracked repos case-insensitively and creates hidden textless files", async (t) => {
  const f = await fixture(t);
  f.options.runner = async (command, args) => {
    assert.equal(command, "gh");
    assert.deepEqual(args.slice(0, 2), ["api", "graphql"]);
    assert.ok(args.includes("owner=reedpen"));
    return {
      stdout: JSON.stringify({
        data: {
          user: {
            pinnedItems: {
              nodes: [
                { nameWithOwner: "REEDPEN/ALPHA", isPrivate: false },
                { nameWithOwner: "reedpen/new_tool", isPrivate: false },
                { nameWithOwner: "reedpen/new_tool", isPrivate: false },
              ],
            },
          },
        },
      }),
    };
  };
  await f.run(["discover"]);
  assert.deepEqual(await f.readProject("new-tool"), {
    title: "New Tool",
    repo: "reedpen/new_tool",
    site: false,
    resume: false,
    autoSummary: true,
  });
  assert.equal((await readdir(join(f.data, "projects"))).length, 2);
  assert.match(f.logs.join("\n"), /hidden/);
});

test("public discovery paginates and filters foreign, fork, archived and private repos", async (t) => {
  const f = await fixture(t, {}, {}, { discover: "public" });
  const repo = (name, extras = {}) => ({
    full_name: `reedpen/${name}`,
    owner: { login: "reedpen" },
    private: false,
    fork: false,
    archived: false,
    ...extras,
  });
  f.options.runner = async (command, args) => {
    assert.equal(command, "gh");
    assert.deepEqual(args, [
      "api",
      "--paginate",
      "--slurp",
      "users/reedpen/repos?type=owner&per_page=100",
    ]);
    return {
      stdout: JSON.stringify([
        [
          repo("first"),
          repo("fork", { fork: true }),
          repo("private", { private: true }),
        ],
        [
          repo("second"),
          repo("archived", { archived: true }),
          repo("foreign", { owner: { login: "elsewhere" } }),
        ],
      ]),
    };
  };
  await f.run(["discover"]);
  assert.deepEqual(await readdir(join(f.data, "projects")), [
    "first.yaml",
    "second.yaml",
  ]);
});

test("discover none performs no external calls; collisions never overwrite files", async (t) => {
  const f = await fixture(
    t,
    { alpha: { title: "Other", repo: "other/thing" } },
    {},
    { discover: "none" },
  );
  await f.run(["discover"]);
  assert.equal(f.calls.length, 0);
  await writeFile(
    join(f.data, "projects.config.yaml"),
    stringify(policySchema.parse({})),
  );
  f.options.runner = async () => ({
    stdout: JSON.stringify({
      data: {
        user: { pinnedItems: { nodes: [{ nameWithOwner: "reedpen/alpha" }] } },
      },
    }),
  });
  await f.run(["discover"]);
  assert.equal((await f.readProject("alpha")).repo, "other/thing");
  assert.equal((await f.readProject("alpha-2")).repo, "reedpen/alpha");
});

test("refresh skips unchanged commit and honors force with exact Codex flags", async (t) => {
  const f = await fixture(
    t,
    {
      alpha: {
        title: "Alpha",
        repo: "reedpen/alpha",
        resume: true,
        bullets: [
          "Built the first example.",
          "Implemented the second example.",
        ],
      },
    },
    { alpha: cached },
  );
  fakeRefresh(f);
  const before = await snapshot(f.data);
  assert.equal(await f.run(["refresh"]), 0);
  assert.deepEqual(await snapshot(f.data), before);
  assert.equal(f.calls.length, 2);
  assert.equal(await f.run(["refresh", "alpha", "--force"]), 0);
  const args = f.calls.find(([command]) => command === "codex")[1];
  assert.deepEqual(args.slice(0, 7), [
    "exec",
    "-m",
    "gpt-6.1-sol",
    "-c",
    "model_reasoning_effort=medium",
    "-s",
    "read-only",
  ]);
  for (const flag of [
    "-C",
    "--skip-git-repo-check",
    "--ephemeral",
    "--output-schema",
    "-o",
  ])
    assert.ok(args.includes(flag));
  assert.match(args.at(-1), /Built the first example/);
  assert.match(args.at(-1), /Implemented the second example/);
  assert.equal((await f.readGenerated()).projects.alpha.model, "gpt-6.1-sol");
  assert.deepEqual(await readdir(f.tempRoot), []);
});

test("private policy blocks cloning and per-project allowPrivate or global includePrivate permits it", async (t) => {
  for (const [global, local, allowed] of [
    [false, false, false],
    [false, true, true],
    [true, false, true],
  ]) {
    const f = await fixture(
      t,
      { alpha: { title: "Alpha", repo: "reedpen/alpha", allowPrivate: local } },
      {},
      { includePrivate: global },
    );
    fakeRefresh(f, { privateRepos: ["reedpen/alpha"] });
    assert.equal(await f.run(["refresh"]), 0);
    assert.equal(
      f.calls.some(([command]) => command === "codex"),
      allowed,
    );
    if (!allowed) {
      assert.equal(f.calls.length, 1);
      assert.match(f.logs.join("\n"), /private repository/);
    } else assert.equal((await f.readGenerated()).projects.alpha.private, true);
    assert.deepEqual(await readdir(f.tempRoot), []);
  }
});

test("refresh isolates GitHub failures and invalid Codex output, keeps old entries, sorts keys, and cleans temps", async (t) => {
  const f = await fixture(
    t,
    {
      zulu: { title: "Zulu", repo: "reedpen/zulu" },
      alpha: { title: "Alpha", repo: "reedpen/alpha" },
      broken: { title: "Broken", repo: "reedpen/broken" },
      invalid: { title: "Invalid", repo: "reedpen/invalid" },
    },
    {
      untouched: cached,
      invalid: { ...cached, repo: "reedpen/invalid", commit: "old" },
    },
  );
  fakeRefresh(f, {
    failures: ["reedpen/broken"],
    invalid: ["reedpen/invalid"],
  });
  assert.equal(await f.run(["refresh", "--jobs", "2"]), 1);
  const generated = await f.readGenerated();
  assert.deepEqual(Object.keys(generated.projects), [
    "alpha",
    "invalid",
    "untouched",
    "zulu",
  ]);
  assert.equal(generated.projects.invalid.commit, "old");
  assert.deepEqual(generated.projects.untouched, cached);
  const source = await readFile(
    join(f.data, "projects.generated.json"),
    "utf8",
  );
  assert.ok(source.endsWith("\n"));
  assert.match(
    f.logs.join("\n"),
    /2 refreshed \/ 0 unchanged \/ 0 skipped \/ 2 failed/,
  );
  assert.deepEqual(await readdir(f.tempRoot), []);
});

test("Codex process failure cleans its temporary directory", async (t) => {
  const f = await fixture(t);
  fakeRefresh(f);
  const original = f.options.runner;
  f.options.runner = async (command, args) => {
    if (command === "codex") throw new Error("Fake Codex failure");
    return original(command, args);
  };
  assert.equal(await f.run(["refresh"]), 1);
  assert.deepEqual((await f.readGenerated()).projects, {});
  assert.deepEqual(await readdir(f.tempRoot), []);
});

test("branch movement cannot save summaries under a different commit", async (t) => {
  const f = await fixture(t);
  fakeRefresh(f, { moved: ["reedpen/alpha"] });
  assert.equal(await f.run(["refresh"]), 1);
  assert.match(f.logs.join("\n"), /changed during clone/);
  assert.ok(!f.calls.some(([command]) => command === "codex"));
  assert.deepEqual(await readdir(f.tempRoot), []);
});

test("jobs bounds concurrent Codex runs; disabled and no-repo projects skip; reports all enabled missing text", async (t) => {
  const f = await fixture(t, {
    alpha: { title: "Alpha", repo: "reedpen/alpha" },
    beta: { title: "Beta", repo: "reedpen/beta" },
    gamma: { title: "Gamma", repo: "reedpen/gamma" },
    disabled: {
      title: "Disabled",
      repo: "reedpen/disabled",
      autoSummary: false,
      site: true,
    },
    missing: { title: "Missing", resume: true },
  });
  const fake = fakeRefresh(f, { delay: true });
  assert.equal(await f.run(["refresh", "--jobs", "2"]), 0);
  assert.equal(fake.maxActive(), 2);
  assert.match(f.logs.join("\n"), /Warning: disabled/);
  assert.match(f.logs.join("\n"), /Warning: missing/);
  assert.match(
    f.logs.join("\n"),
    /3 refreshed \/ 0 unchanged \/ 2 skipped \/ 0 failed/,
  );
});

test("discover and refresh dry runs write nothing and never clone or invoke Codex", async (t) => {
  const f = await fixture(t);
  const before = await snapshot(f.root);
  f.options.runner = async () => ({
    stdout: JSON.stringify({
      data: {
        user: { pinnedItems: { nodes: [{ nameWithOwner: "reedpen/new" }] } },
      },
    }),
  });
  await f.run(["discover", "--dry-run"]);
  assert.deepEqual(await snapshot(f.root), before);
  fakeRefresh(f);
  assert.equal(await f.run(["refresh", "--dry-run", "--force"]), 0);
  assert.deepEqual(await snapshot(f.root), before);
  assert.ok(
    f.calls.every(([command, args]) => command === "gh" && args[0] === "api"),
  );
  assert.match(f.logs.join("\n"), /would refresh/);
});

test("policy and output validation reject bad types, unknown keys and excessive lengths", () => {
  assert.equal(
    policySchema.safeParse({ includePrivate: "yes" }).success,
    false,
  );
  assert.equal(policySchema.safeParse({ discover: "all" }).success, false);
  assert.equal(policySchema.safeParse({ maxBullets: 0 }).success, false);
  assert.equal(policySchema.safeParse({ typo: true }).success, false);
  const schema = outputSchema(1);
  for (const invalid of [
    { ...text, summary: "word ".repeat(31) },
    { ...text, bullets: ["word ".repeat(36)] },
    { ...text, bullets: [] },
    { ...text, bullets: ["First.", "Second."] },
    { ...text, technologies: Array(9).fill("Tool") },
    { ...text, extra: true },
  ])
    assert.equal(schema.safeParse(invalid).success, false);
});

test("invalid options and commands fail before external work", async (t) => {
  const f = await fixture(t);
  for (const args of [
    ["refresh", "--jobs", "0"],
    ["refresh", "--jobs", "1.5"],
    ["refresh", "--jobs"],
    ["refresh", "--oops"],
    ["discover", "--force"],
    ["public"],
    ["auto", "yes", "alpha"],
    ["wat"],
  ])
    await assert.rejects(f.run(args));
  assert.equal(f.calls.length, 0);
});

test("refresh provider override locks clone config and records OpenCode model without changing policy", async (t) => {
  const f = await fixture(t);
  fakeRefresh(f);
  const original = f.options.runner;
  const configBefore = await readFile(
    join(f.data, "projects.config.yaml"),
    "utf8",
  );
  f.options.runner = async (command, args, options) => {
    if (command === "opencode") {
      assert.equal(options.cwd.split("/").at(-1), "repo");
      assert.deepEqual(await readdir(options.cwd), ["opencode.json"]);
      const config = JSON.parse(
        await readFile(join(options.cwd, "opencode.json"), "utf8"),
      );
      assert.equal(config.permission["*"], "deny");
      assert.equal(config.permission.read, "allow");
      return {
        stdout: [
          { type: "step_start" },
          { type: "text", part: { text: JSON.stringify(text) } },
          { type: "step_finish", part: { reason: "stop" } },
        ]
          .map((event) => JSON.stringify(event))
          .join("\n"),
      };
    }
    assert.notEqual(command, "codex");
    const result = await original(command, args);
    if (command === "gh" && args[0] === "repo") {
      await writeFile(join(args[3], "opencode.json"), "untrusted");
      await writeFile(join(args[3], "opencode.jsonc"), "untrusted");
      await mkdir(join(args[3], ".opencode"));
      await writeFile(join(args[3], ".opencode", "plugin.js"), "untrusted");
    }
    return result;
  };
  assert.equal(await f.run(["refresh", "--provider", "opencode"]), 0);
  assert.equal(
    (await f.readGenerated()).projects.alpha.model,
    "opencode/deepseek-v4.1-flash-free",
  );
  assert.equal(
    await readFile(join(f.data, "projects.config.yaml"), "utf8"),
    configBefore,
  );
  assert.deepEqual(await readdir(f.tempRoot), []);
});

test("refresh can override OpenCode policy with Codex and rejects unknown providers", async (t) => {
  const f = await fixture(t, undefined, {}, { provider: "opencode" });
  fakeRefresh(f);
  assert.equal(await f.run(["refresh", "--provider", "codex"]), 0);
  assert.ok(f.calls.some(([command]) => command === "codex"));
  for (const args of [
    ["refresh", "--provider", "unknown"],
    ["refresh", "--provider"],
  ])
    await assert.rejects(f.run(args), /--provider requires codex or opencode/);
});
