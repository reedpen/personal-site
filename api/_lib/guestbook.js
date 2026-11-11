// Guestbook storage shared by the Vercel function and the guestbook command.
// Files under api/_lib are not deployed as functions.
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/**
 * @typedef {(text: string, params?: unknown[]) => Promise<Record<string, any>[]>} Query
 */

export const limits = {
  name: 80,
  message: 1000,
  /** Notes accepted from one address per hour. */
  perAddressPerHour: 5,
  /** Notes accepted from everyone together per hour. */
  totalPerHour: 30,
  /** Notes shown on the site. */
  shown: 50,
};

/** Cache tag on the public entry list; deleting it shows changes at once. */
export const cacheTag = "guestbook";

/** @type {Query | undefined} */
let query;

/** @returns {Query} */
export function database() {
  if (!query) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    const sql = neon(url);
    query = (text, params = []) => sql.query(text, params);
  }
  return query;
}

/** Replaces the database connection, for tests. @param {Query} replacement */
export function useDatabase(replacement) {
  query = replacement;
}

export async function setup() {
  const db = database();
  await db(`
    CREATE TABLE IF NOT EXISTS guestbook_entries (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      address_hash TEXT
    )
  `);
  await db(`
    CREATE INDEX IF NOT EXISTS guestbook_entries_created_at
      ON guestbook_entries (created_at)
  `);
}

/** The newest entries, newest first. */
export async function recentEntries(limit = limits.shown) {
  const rows = await database()(
    `SELECT id, name, message, created_at
       FROM guestbook_entries
      ORDER BY id DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    message: row.message,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

/** Hashes the address so raw IP addresses are never stored. */
function hashAddress(address) {
  const salt = process.env.GUESTBOOK_SALT || "";
  return createHash("sha256").update(`${salt}:${address}`).digest("hex");
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} address
 * @returns {Promise<{ accepted: true, posted: boolean } | { error: string, status: number }>}
 */
export async function submitEntry(body, address) {
  // Bots fill the hidden field; pretend to accept so they move on.
  if (body.website) return { accepted: true, posted: false };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (
    !name ||
    name.length > limits.name ||
    !message ||
    message.length > limits.message
  ) {
    return {
      error: "Enter a name and message within the limits shown.",
      status: 400,
    };
  }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(`${name}${message}`)) {
    return { error: "Your note contains unsupported characters.", status: 400 };
  }

  const db = database();
  const addressHash = hashAddress(address);
  const [counts] = await db(
    `SELECT
       count(*) AS total,
       count(*) FILTER (WHERE address_hash = $1) AS from_address
     FROM guestbook_entries
     WHERE created_at > now() - interval '1 hour'`,
    [addressHash],
  );
  if (Number(counts.from_address) >= limits.perAddressPerHour) {
    return { error: "Too many notes. Please try again later.", status: 429 };
  }
  if (Number(counts.total) >= limits.totalPerHour) {
    return {
      error: "The guestbook is busy right now. Please try again later.",
      status: 429,
    };
  }

  await db(
    `INSERT INTO guestbook_entries (name, message, address_hash)
     VALUES ($1, $2, $3)`,
    [name, message, addressHash],
  );
  // Address hashes are only needed for the hourly limit.
  await db(
    `UPDATE guestbook_entries SET address_hash = NULL
      WHERE address_hash IS NOT NULL AND created_at < now() - interval '1 day'`,
  );
  return { accepted: true, posted: true };
}

/**
 * @param {number} id
 * @returns {Promise<boolean>} Whether an entry was removed.
 */
export async function removeEntry(id) {
  const rows = await database()(
    "DELETE FROM guestbook_entries WHERE id = $1 RETURNING id",
    [id],
  );
  return rows.length === 1;
}
