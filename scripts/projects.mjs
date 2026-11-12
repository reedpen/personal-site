#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runProjects } from "./lib/projects.mjs";

try {
  process.exitCode = await runProjects(process.argv.slice(2), {
    root: fileURLToPath(new URL("../", import.meta.url)),
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
