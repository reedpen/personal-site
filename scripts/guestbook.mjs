// Guestbook maintenance. Run through `pnpm guestbook`, which loads
// DATABASE_URL from .env.local (created by `vercel env pull`).
import { spawnSync } from "node:child_process";
import {
  cacheTag,
  recentEntries,
  removeEntry,
  setup,
} from "../api/_lib/guestbook.js";

const usage = "Usage: pnpm guestbook setup | list [COUNT] | remove ID...";
const [command, ...args] = process.argv.slice(2);

/** Clears Vercel's cached entry list so a removal shows immediately. */
function clearCache() {
  const result = spawnSync(
    "pnpm",
    [
      "dlx",
      "vercel",
      "cache",
      "dangerously-delete",
      "--tag",
      cacheTag,
      "--yes",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0)
    console.error(
      "Could not clear Vercel's cache; removed entries disappear from the site within an hour.",
    );
}

if (command === "setup") {
  await setup();
  console.log("Guestbook table is ready.");
} else if (
  command === "list" &&
  args.length <= 1 &&
  /^\d*$/.test(args[0] ?? "")
) {
  const entries = await recentEntries(Number(args[0] || 20));
  if (entries.length === 0) console.log("The guestbook is empty.");
  for (const entry of entries.reverse()) {
    console.log(
      `\n#${entry.id} · ${entry.createdAt} · ${entry.name}\n${entry.message}`,
    );
  }
} else if (
  command === "remove" &&
  args.length > 0 &&
  args.every((id) => /^\d+$/.test(id))
) {
  let removed = 0;
  for (const id of args) {
    if (await removeEntry(Number(id))) {
      console.log(`Removed entry #${id}.`);
      removed++;
    } else {
      console.error(`No entry #${id}.`);
      process.exitCode = 1;
    }
  }
  if (removed > 0) clearCache();
} else {
  console.error(usage);
  process.exitCode = 1;
}
