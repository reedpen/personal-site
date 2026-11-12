import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProcess } from "../scripts/lib/projects-runner.mjs";
import { policySchema } from "../scripts/lib/projects-config.mjs";
import { runModel } from "../scripts/lib/projects-llm.mjs";
import {
  outputSchema,
  codexJsonSchema,
} from "../scripts/lib/projects-prompt.mjs";

const result = {
  summary: "Tracks changes.",
  bullets: ["Built change tracking."],
  technologies: ["JavaScript"],
};
const jsonl = (...events) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";
const answer = (text) =>
  jsonl(
    { type: "step_start" },
    { type: "text", part: { text } },
    { type: "step_finish", part: { reason: "stop" } },
  );

async function fixture(t, provider = "opencode") {
  const tempDir = await mkdtemp(join(tmpdir(), "llm-test-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const cwd = join(tempDir, "repo");
  await mkdir(cwd);
  return {
    policy: policySchema.parse({ provider }),
    cwd,
    tempDir,
    prompt: "Read the code.",
    jsonSchema: codexJsonSchema(3),
    zodSchema: outputSchema(3),
  };
}

test("OpenCode uses locked permissions, cwd, schema prompt and final step text parts", async (t) => {
  const options = await fixture(t);
  await writeFile(join(options.cwd, "opencode.json"), '{"permission":"allow"}');
  await writeFile(join(options.cwd, "opencode.jsonc"), "// untrusted");
  await mkdir(join(options.cwd, ".opencode"));
  await writeFile(join(options.cwd, ".opencode", "plugin.js"), "untrusted");
  const output = JSON.stringify(result);
  const actual = await runModel({
    ...options,
    runner: async (command, args, processOptions) => {
      assert.equal(command, "opencode");
      assert.deepEqual(processOptions, { cwd: options.cwd });
      assert.deepEqual(args.slice(0, 6), [
        "run",
        "-m",
        "opencode/deepseek-v4.1-flash-free",
        "--format",
        "json",
        "--archived",
      ]);
      assert.equal(args.length, 7);
      assert.ok(args[6].startsWith(options.prompt));
      assert.ok(args[6].includes(JSON.stringify(options.jsonSchema)));
      assert.deepEqual(await readdir(options.cwd), ["opencode.json"]);
      assert.deepEqual(
        JSON.parse(await readFile(join(options.cwd, "opencode.json"), "utf8")),
        {
          $schema: "https://opencode.ai/config.json",
          permission: {
            "*": "deny",
            read: "allow",
            glob: "allow",
            grep: "allow",
            list: "allow",
          },
        },
      );
      return {
        stdout: jsonl(
          { type: "step_start" },
          { type: "text", part: { text: '{"wrong":true}' } },
          { type: "tool_use", part: { tool: "read" } },
          { type: "step_finish", part: { reason: "tool-calls" } },
          { type: "step_start" },
          {
            type: "text",
            part: {
              text: "Here is the answer:\n```json\n" + output.slice(0, 30),
            },
          },
          { type: "text", part: { text: output.slice(30) + "\n```\nDone." } },
          { type: "step_finish", part: { reason: "stop" } },
        ),
      };
    },
  });
  assert.deepEqual(actual, {
    result,
    model: "opencode/deepseek-v4.1-flash-free",
  });
});

test("OpenCode retries parse and Zod failures once with validation feedback", async (t) => {
  for (const invalid of [
    "not JSON",
    JSON.stringify({ ...result, bullets: [] }),
  ]) {
    const options = await fixture(t);
    const prompts = [];
    const actual = await runModel({
      ...options,
      runner: async (_command, args) => {
        prompts.push(args.at(-1));
        return {
          stdout: answer(
            prompts.length === 1 ? invalid : JSON.stringify(result),
          ),
        };
      },
    });
    assert.deepEqual(actual.result, result);
    assert.equal(prompts.length, 2);
    assert.ok(prompts[1].startsWith(prompts[0]));
    assert.match(prompts[1], /Previous output failed validation:/);
  }
});

test("OpenCode fails clearly after two invalid responses", async (t) => {
  const options = await fixture(t);
  let calls = 0;
  await assert.rejects(
    runModel({
      ...options,
      runner: async () => {
        calls++;
        return { stdout: answer('{"summary":"incomplete"}') };
      },
    }),
    /OpenCode output invalid after 2 attempts:/,
  );
  assert.equal(calls, 2);
});

test("OpenCode error events and process failures do not retry", async (t) => {
  for (const event of [
    { type: "error", error: { data: { message: "Rate limited" } } },
    { type: "step_finish", error: { message: "Rate limited" } },
    { type: "error", message: "Rate limited" },
  ]) {
    const options = await fixture(t);
    let calls = 0;
    await assert.rejects(
      runModel({
        ...options,
        runner: async () => {
          calls++;
          return { stdout: answer(JSON.stringify(result)) + jsonl(event) };
        },
      }),
      /OpenCode error:.*Rate limited/,
    );
    assert.equal(calls, 1);
  }
  const options = await fixture(t);
  let calls = 0;
  await assert.rejects(
    runModel({
      ...options,
      runner: async () => {
        calls++;
        throw new Error("Process failed");
      },
    }),
    /Process failed/,
  );
  assert.equal(calls, 1);
});

test("Codex retains its exact command and schema/output file behavior", async (t) => {
  const options = await fixture(t, "codex");
  options.policy.codex = { model: "custom-model", reasoningEffort: "high" };
  const actual = await runModel({
    ...options,
    runner: async (command, args, processOptions) => {
      assert.equal(command, "codex");
      assert.equal(processOptions, undefined);
      assert.deepEqual(args, [
        "exec",
        "-m",
        "custom-model",
        "-c",
        "model_reasoning_effort=high",
        "-s",
        "read-only",
        "-C",
        options.cwd,
        "--skip-git-repo-check",
        "--ephemeral",
        "--output-schema",
        join(options.tempDir, "schema.json"),
        "-o",
        join(options.tempDir, "output.json"),
        options.prompt,
      ]);
      assert.deepEqual(
        JSON.parse(
          await readFile(join(options.tempDir, "schema.json"), "utf8"),
        ),
        options.jsonSchema,
      );
      await writeFile(
        join(options.tempDir, "output.json"),
        JSON.stringify(result),
      );
    },
  });
  assert.deepEqual(actual, { result, model: "custom-model" });
});

test("provider config defaults and strict nested validation", () => {
  const defaults = policySchema.parse({});
  assert.equal(defaults.provider, "codex");
  assert.deepEqual(defaults.codex, {
    model: "gpt-6.1-sol",
    reasoningEffort: "medium",
  });
  assert.deepEqual(defaults.opencode, {
    model: "opencode/deepseek-v4.1-flash-free",
  });
  assert.deepEqual(policySchema.parse({ codex: {}, opencode: {} }), defaults);
  assert.equal(
    policySchema.parse({ provider: "opencode" }).provider,
    "opencode",
  );
  for (const invalid of [
    { provider: "other" },
    { model: "old" },
    { reasoningEffort: "medium" },
    { codex: { model: " " } },
    { codex: { reasoningEffort: "bad" } },
    { codex: { extra: true } },
    { opencode: { extra: true } },
    ...["model", "provider/", "/model", "a/b/c", "a/b c"].map((model) => ({
      opencode: { model },
    })),
  ])
    assert.equal(
      policySchema.safeParse(invalid).success,
      false,
      JSON.stringify(invalid),
    );
});

test("OpenCode output is refused when a tool reads outside the locked directory", async (t) => {
  const options = await fixture(t);
  let calls = 0;
  const tool = (path) => ({
    type: "tool_use",
    part: { tool: "read", state: { input: { path } } },
  });
  await assert.rejects(
    runModel({
      ...options,
      runner: async () => {
        calls++;
        return {
          stdout:
            jsonl(
              { type: "step_start" },
              tool(join(options.cwd, "README.md")),
              tool("src/index.js"),
              tool("/home/owner/other-project/README.md"),
              { type: "step_finish", part: { reason: "tool-calls" } },
            ) + answer(JSON.stringify(result)),
        };
      },
    }),
    /accessed \/home\/owner\/other-project\/README\.md, outside/,
  );
  assert.equal(calls, 1);
});

test("child processes see PWD set to their working directory", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "runner-pwd-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { stdout } = await runProcess("sh", ["-c", 'printf %s "$PWD"'], {
    cwd: dir,
  });
  assert.equal(stdout, dir);
});
