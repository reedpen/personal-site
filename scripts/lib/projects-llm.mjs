import { readFile, realpath, writeFile, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const pathKeys = ["path", "filePath", "directory", "cwd"];

/** Fails if a tool call reached outside the directory OpenCode was locked to. */
function checkToolPaths(event, roots) {
  const input = event.part?.state?.input;
  if (!input || typeof input !== "object") return;
  for (const key of pathKeys) {
    const value = input[key];
    if (typeof value !== "string") continue;
    const inside = roots.some((root) => {
      const rel = relative(root, resolve(root, value));
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    });
    if (!inside)
      throw new Error(
        `OpenCode ${event.part.tool ?? "tool"} accessed ${value}, outside ${roots[0]}; refusing its output`,
      );
  }
}

function parseOpenCode(stdout, roots) {
  let text = "";
  let finalText;
  for (const line of stdout.split(/\r?\n/).filter((line) => line.trim())) {
    const event = JSON.parse(line);
    if (event.type === "error" || Object.hasOwn(event, "error"))
      throw new Error(
        `OpenCode error: ${JSON.stringify(event.error ?? event.part ?? event)}`,
      );
    if (event.type === "tool_use") checkToolPaths(event, roots);
    if (event.type === "step_start") text = "";
    if (event.type === "text") text += event.part.text;
    if (event.type === "step_finish" && event.part.reason === "stop")
      finalText = text;
  }
  if (finalText === undefined)
    throw new SyntaxError("Missing final OpenCode step (stop)");
  const stripped = finalText.replace(/```(?:json)?\s*|```/gi, "");
  return JSON.parse(
    stripped.slice(stripped.indexOf("{"), stripped.lastIndexOf("}") + 1),
  );
}

export async function runModel({
  policy,
  cwd,
  prompt,
  jsonSchema,
  zodSchema,
  runner,
  tempDir,
}) {
  if (policy.provider === "codex") {
    const schemaFile = join(tempDir, "schema.json");
    const outputFile = join(tempDir, "output.json");
    await writeFile(schemaFile, `${JSON.stringify(jsonSchema, null, 2)}\n`);
    await runner("codex", [
      "exec",
      "-m",
      policy.codex.model,
      "-c",
      `model_reasoning_effort=${policy.codex.reasoningEffort}`,
      "-s",
      "read-only",
      "-C",
      cwd,
      "--skip-git-repo-check",
      "--ephemeral",
      "--output-schema",
      schemaFile,
      "-o",
      outputFile,
      prompt,
    ]);
    return {
      result: zodSchema.parse(JSON.parse(await readFile(outputFile, "utf8"))),
      model: policy.codex.model,
    };
  }
  if (policy.provider !== "opencode")
    throw new Error(`Unknown provider: ${policy.provider}`);
  // Never trust OpenCode configuration supplied by the repository being read.
  for (const name of ["opencode.json", "opencode.jsonc", ".opencode"])
    await rm(join(cwd, name), { recursive: true, force: true });
  await writeFile(
    join(cwd, "opencode.json"),
    `${JSON.stringify(
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
      null,
      2,
    )}\n`,
  );
  const roots = [resolve(cwd), await realpath(cwd)];
  const instruction = `${prompt}\nReturn only JSON matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
  let note = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { stdout } = await runner(
      "opencode",
      [
        "run",
        "-m",
        policy.opencode.model,
        "--format",
        "json",
        "--archived",
        instruction + note,
      ],
      { cwd },
    );
    try {
      return {
        result: zodSchema.parse(parseOpenCode(stdout, roots)),
        model: policy.opencode.model,
      };
    } catch (error) {
      // Provider error events are terminal; only malformed or invalid output retries.
      if (!(error instanceof SyntaxError) && error.name !== "ZodError")
        throw error;
      if (attempt === 1)
        throw new Error(
          `OpenCode output invalid after 2 attempts: ${error.message}`,
        );
      note = `\nPrevious output failed validation: ${error.message.slice(0, 1000)}\nCorrect it and return only the required JSON.`;
    }
  }
}
