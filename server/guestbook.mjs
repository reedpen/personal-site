import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env.DATA_DIR || "/data";
mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(`${dataDir}/guestbook.sqlite`);
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected'))
  );
  CREATE INDEX IF NOT EXISTS entries_status_created ON entries(status, created_at DESC);
`);

const attempts = new Map();
setInterval(
  () => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [ip, times] of attempts) {
      const recent = times.filter((time) => time > cutoff);
      if (recent.length) attempts.set(ip, recent);
      else attempts.delete(ip);
    }
  },
  60 * 60 * 1000,
).unref();

export function publicEntries() {
  return db
    .prepare(
      "SELECT id, name, message, created_at AS createdAt FROM entries WHERE status = 'approved' ORDER BY id DESC LIMIT 50",
    )
    .all();
}

export function submitEntry(body, ip) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (body.website) return { accepted: true };
  if (!name || name.length > 80 || !message || message.length > 1000) {
    return { error: "Enter a name and message within the limits shown." };
  }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(`${name}${message}`)) {
    return { error: "Your note contains unsupported characters." };
  }
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter(
    (time) => now - time < 60 * 60 * 1000,
  );
  if (recent.length >= 5)
    return {
      error: "Too many notes. Please try again later.",
      rateLimited: true,
    };
  recent.push(now);
  attempts.set(ip, recent);
  db.prepare(
    "INSERT INTO entries (name, message, created_at) VALUES (?, ?, ?)",
  ).run(name, message, new Date(now).toISOString());
  return { accepted: true };
}
