import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Document } from "yaml";
import {
  loadPortfolio,
  projectFileSchema,
  generatedFileSchema,
} from "../../src/lib/portfolio.mjs";
import {
  readStore,
  readPolicy,
  selectProjects,
  writeGenerated,
  effectiveText,
} from "./projects-store.mjs";
import { discoverRepos, repoMetadata, headCommit } from "./projects-github.mjs";
import {
  buildPrompt,
  codexJsonSchema,
  outputSchema,
} from "./projects-prompt.mjs";
import { classifyStack, runStack } from "./projects-stack.mjs";
import { runModel } from "./projects-llm.mjs";
import { runProcess } from "./projects-runner.mjs";

export const help = `Usage: pnpm projects <command>
  list                              Show visibility, text source, and cached commit
  public <slug...>                   Enable projects on the website
  hide <slug...>                     Hide projects from the website
  resume <on|off> <slug...>          Set résumé inclusion
  auto <on|off> <slug...>            Set automatic text generation
  discover [--dry-run]               Add repositories according to policy
  refresh [slug...] [--force] [--dry-run] [--jobs N] [--provider codex|opencode]
                                    Refresh automatic summaries (default jobs: 2)
  stack                             Show computed stack, unfiled and hidden technologies
  stack hide <tech...> / stack show <tech...>
                                    Control automatic stack additions
  stack add <category-label> <tech...>
                                    File technologies under a profile skill label
  stack classify [--dry-run] [--provider codex|opencode]
                                    Classify unfiled technologies
  help                              Show this help

Policy: src/data/projects.config.yaml. New projects default to hidden.
Refresh edits local files only. Review git diff before committing.`;

function parseArgs(args) {
  const options = { slugs: [], dryRun: false, force: false, jobs: 2 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--provider") {
      options.provider = args[++i];
      if (!["codex", "opencode"].includes(options.provider))
        throw new Error("--provider requires codex or opencode");
    } else if (arg === "--jobs") {
      const value = args[++i];
      if (
        !value ||
        !/^[1-9]\d*$/.test(value) ||
        !Number.isSafeInteger(Number(value))
      )
        throw new Error("--jobs requires a positive integer");
      options.jobs = Number(value);
    } else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else options.slugs.push(arg);
  }
  return options;
}

function textSource(project, cached) {
  const fields = ["summary", "bullets", "technologies"];
  const manual = fields.some((field) =>
    field === "summary" ? !!project[field] : project[field]?.length > 0,
  );
  const generated =
    project.autoSummary &&
    fields.some(
      (field) =>
        project[field] === undefined &&
        (field === "summary" ? !!cached?.[field] : cached?.[field]?.length > 0),
    );
  const text = effectiveText(project, cached);
  if (!text.summary && !text.bullets.length) return "missing";
  return [manual && "manual", generated && "generated"]
    .filter(Boolean)
    .join("+");
}

async function discover(store, policy, options, runner, log) {
  const repos = await discoverRepos(runner, policy);
  const tracked = new Set(
    store.projects.map((p) => p.value.repo?.toLowerCase()).filter(Boolean),
  );
  const slugs = new Set(store.projects.map((p) => p.slug));
  let added = 0;
  for (const item of repos) {
    // Validate GitHub's name before deriving any filesystem path.
    projectFileSchema.parse({ title: "Discovered", repo: item.repo });
    if (tracked.has(item.repo.toLowerCase())) continue;
    const name = item.repo.split("/")[1];
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "project";
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
    const value = {
      title: name
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      repo: item.repo,
      ...policy.newProjects,
      autoSummary: true,
    };
    if (!options.dryRun)
      await writeFile(
        join(store.directory, `${slug}.yaml`),
        new Document(value).toString(),
        { flag: "wx" },
      );
    tracked.add(item.repo.toLowerCase());
    slugs.add(slug);
    added++;
    log(`${options.dryRun ? "Would add" : "Added"} ${slug} (${item.repo})`);
  }
  log(
    `${added} project(s) ${options.dryRun ? "would be added" : "added"}. New projects start ${policy.newProjects.site ? "site enabled" : "hidden on the website"}, résumé ${policy.newProjects.resume ? "on" : "off"}; review before enabling them.`,
  );
}

async function generate(project, metadata, commit, policy, examples, context) {
  const temporary = await mkdtemp(join(context.tempRoot, "projects-refresh-"));
  try {
    const clone = join(temporary, "repo");
    await context.runner("gh", [
      "repo",
      "clone",
      project.repo,
      clone,
      "--",
      "--depth",
      "1",
      "--branch",
      metadata.default_branch,
    ]);
    const actual = await context.runner("git", [
      "-C",
      clone,
      "rev-parse",
      "HEAD",
    ]);
    if (actual.stdout.trim() !== commit)
      throw new Error("Default branch changed during clone; run refresh again");
    const { result, model } = await runModel({
      policy,
      cwd: clone,
      prompt: buildPrompt(policy.maxBullets, examples),
      jsonSchema: codexJsonSchema(policy.maxBullets),
      zodSchema: outputSchema(policy.maxBullets),
      runner: context.runner,
      tempDir: temporary,
    });
    return {
      repo: project.repo,
      commit,
      generatedAt: context.now().toISOString(),
      model,
      ...result,
      pushedAt: metadata.pushed_at,
      private: metadata.private,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function refresh(store, policy, options, context) {
  const selected = selectProjects(store.projects, options.slugs);
  const examples = store.projects
    .filter((p) => p.value.resume)
    .flatMap((p) => p.value.bullets ?? []);
  // Prefer résumé-selected bullets; fall back to other owner-written projects.
  const style = [
    ...examples,
    ...store.projects
      .filter((p) => !p.value.resume)
      .flatMap((p) => p.value.bullets ?? []),
  ].slice(0, 2);
  const counts = { refreshed: 0, unchanged: 0, skipped: 0, failed: 0 };
  let next = 0;
  async function worker() {
    while (next < selected.length) {
      const { slug, value: project } = selected[next++];
      try {
        if (!project.repo || !project.autoSummary) {
          counts.skipped++;
          context.log(
            `${slug}: skipped (${!project.repo ? "no repository" : "autoSummary is off"})`,
          );
          continue;
        }
        const metadata = await repoMetadata(context.runner, project.repo);
        if (
          metadata.private &&
          !policy.includePrivate &&
          !project.allowPrivate
        ) {
          counts.skipped++;
          context.log(
            `${slug}: skipped (private repository; includePrivate and allowPrivate are false)`,
          );
          continue;
        }
        const commit = await headCommit(
          context.runner,
          project.repo,
          metadata.default_branch,
        );
        const cached = store.generated.projects[slug];
        if (
          !options.force &&
          cached?.repo.toLowerCase() === project.repo.toLowerCase() &&
          cached.commit === commit
        ) {
          counts.unchanged++;
          context.log(`${slug}: unchanged (${commit.slice(0, 8)})`);
          continue;
        }
        if (options.dryRun) {
          counts.refreshed++;
          context.log(`${slug}: would refresh (${commit.slice(0, 8)})`);
          continue;
        }
        const entry = await generate(
          project,
          metadata,
          commit,
          policy,
          style,
          context,
        );
        // Validate metadata too, before accepting this project's result.
        generatedFileSchema.parse({ version: 1, projects: { [slug]: entry } });
        store.generated.projects[slug] = entry;
        counts.refreshed++;
        context.log(`${slug}: refreshed (${commit.slice(0, 8)})`);
      } catch (error) {
        counts.failed++;
        context.log(`${slug}: failed: ${error.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(options.jobs, selected.length) }, worker),
  );
  if (!options.dryRun && counts.refreshed)
    await writeGenerated(store.generatedFile, store.generated);
  context.log(
    `${options.dryRun ? "Dry run (refreshed = would refresh): " : ""}${Object.entries(
      counts,
    )
      .map(([key, count]) => `${count} ${key}`)
      .join(" / ")}`,
  );
  const missing = store.projects.filter(({ slug, value }) => {
    const text = effectiveText(value, store.generated.projects[slug]);
    return (
      (value.site || value.resume) && !text.summary && !text.bullets.length
    );
  });
  for (const project of missing)
    context.log(
      `Warning: ${project.slug} is site/resume enabled but still has no text.`,
    );
  try {
    const portfolio = loadPortfolio({ root: context.root });
    if (!options.dryRun && counts.refreshed) {
      try {
        await classifyStack(portfolio, false, { ...context, policy });
      } catch (error) {
        counts.failed++;
        context.log(`Stack classification failed: ${error.message}`);
      }
    }
  } catch (error) {
    context.log(`Portfolio validation: ${error.message}`);
  }
  return counts.failed ? 1 : 0;
}

/** All processes are injectable; dry runs only read metadata and local files. */
export async function runProjects(
  args,
  {
    root,
    runner = runProcess,
    log = console.log,
    tempRoot = tmpdir(),
    now = () => new Date(),
  } = {},
) {
  const [command = "help", ...rest] = args;
  if (command === "help" || command === "--help" || command === "-h") {
    log(help);
    return 0;
  }
  if (command === "stack")
    return runStack(rest, { root, runner, log, tempRoot });
  if (
    ![
      "list",
      "public",
      "hide",
      "resume",
      "auto",
      "discover",
      "refresh",
    ].includes(command)
  )
    throw new Error(`Unknown command: ${command}. Run pnpm projects help.`);
  const store = await readStore(root);
  if (command === "list") {
    if (rest.length) throw new Error("list takes no arguments");
    const rows = [
      ["slug", "site", "resume", "auto", "repo", "text", "commit"],
      ...store.projects.map(({ slug, value }) => [
        slug,
        ...[value.site, value.resume, value.autoSummary].map((on) =>
          on ? "on" : "off",
        ),
        value.repo ?? "—",
        textSource(value, store.generated.projects[slug]),
        store.generated.projects[slug]?.commit.slice(0, 8) ?? "—",
      ]),
    ];
    const widths = rows[0].map((_, i) =>
      Math.max(...rows.map((row) => row[i].length)),
    );
    rows.forEach((row) =>
      log(
        row
          .map((cell, i) => cell.padEnd(widths[i]))
          .join("  ")
          .trimEnd(),
      ),
    );
    return 0;
  }
  if (["public", "hide", "resume", "auto"].includes(command)) {
    const hasSwitch = command === "resume" || command === "auto";
    const setting = hasSwitch
      ? rest.shift()
      : command === "public"
        ? "on"
        : "off";
    if (
      !["on", "off"].includes(setting) ||
      !rest.length ||
      rest.some((slug) => slug.startsWith("-"))
    )
      throw new Error(
        `Usage: pnpm projects ${command} ${hasSwitch ? "<on|off> " : ""}<slug...>`,
      );
    const projects = selectProjects(store.projects, rest);
    const field =
      command === "resume"
        ? "resume"
        : command === "auto"
          ? "autoSummary"
          : "site";
    for (const project of projects) {
      project.doc.set(field, setting === "on");
      await writeFile(project.file, project.doc.toString());
      log(`${project.slug}: ${field} ${setting}`);
    }
    return 0;
  }
  const options = parseArgs(rest);
  if (command === "discover" && rest.some((arg) => arg !== "--dry-run"))
    throw new Error("Usage: pnpm projects discover [--dry-run]");
  const policy = await readPolicy(store.data);
  if (options.provider) policy.provider = options.provider;
  if (command === "discover") {
    await discover(store, policy, options, runner, log);
    return 0;
  }
  return refresh(store, policy, options, { root, runner, log, tempRoot, now });
}
