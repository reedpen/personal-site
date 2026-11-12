import { spawn } from "node:child_process";

// Every external process goes through this boundary. Tests inject a fake runner.
export function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      // Some CLIs (OpenCode) take their project directory from PWD, not the
      // real working directory, so keep PWD in step with cwd.
      env: options.cwd ? { ...process.env, PWD: options.cwd } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (data) => {
      stdout += data;
    });
    child.stderr.setEncoding("utf8").on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `${command} exited ${code}: ${stderr.trim() || "no error output"}`,
          ),
        );
    });
  });
}
