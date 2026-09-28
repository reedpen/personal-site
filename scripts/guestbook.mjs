import { db } from "../server/guestbook.mjs";

const [command, id] = process.argv.slice(2);
if (command === "list") {
  for (const entry of db
    .prepare(
      "SELECT id, name, message, created_at, status FROM entries WHERE status = 'pending' ORDER BY id ASC",
    )
    .all()) {
    console.log(
      `\n#${entry.id} · ${entry.created_at} · ${entry.name}\n${entry.message}`,
    );
  }
} else if (["approve", "reject"].includes(command) && /^\d+$/.test(id || "")) {
  const status = command === "approve" ? "approved" : "rejected";
  const result = db
    .prepare(
      "UPDATE entries SET status = ? WHERE id = ? AND status = 'pending'",
    )
    .run(status, Number(id));
  if (result.changes !== 1) {
    console.error("No pending entry with that ID.");
    process.exitCode = 1;
  } else {
    console.log(`Entry #${id} ${status}.`);
  }
} else {
  console.error("Usage: node scripts/guestbook.mjs list|approve ID|reject ID");
  process.exitCode = 1;
}
db.close();
