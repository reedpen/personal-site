import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  limits,
  recentEntries,
  removeEntry,
  setup,
  submitEntry,
  useDatabase,
} from "../api/_lib/guestbook.js";
import { GET, POST } from "../api/guestbook.js";

const pg = new PGlite();
const rows = async (text, params) => (await pg.query(text, params)).rows;

before(async () => {
  useDatabase(rows);
  await setup();
  await setup(); // Running setup again must be harmless.
});

beforeEach(async () => {
  await pg.query("TRUNCATE guestbook_entries RESTART IDENTITY");
});

after(async () => {
  await pg.close();
});

const note = { name: "Ada", message: "Hello there" };

/** Adds entries from distinct addresses, as if posted `ago` earlier. */
async function seed(count, ago = "0 minutes") {
  await pg.query(
    `INSERT INTO guestbook_entries (name, message, address_hash, created_at)
     SELECT 'n', 'm', 'seed-' || i, now() - $2::interval
       FROM generate_series(1, $1) AS i`,
    [count, ago],
  );
}

describe("submitEntry", () => {
  test("publishes notes immediately, newest first", async () => {
    assert.deepEqual(await submitEntry(note, "1.2.3.4"), {
      accepted: true,
      posted: true,
    });
    await submitEntry({ name: "Grace", message: "Hi" }, "5.6.7.8");
    const entries = await recentEntries();
    assert.deepEqual(
      entries.map((entry) => [entry.id, entry.name, entry.message]),
      [
        [2, "Grace", "Hi"],
        [1, "Ada", "Hello there"],
      ],
    );
    assert.equal(
      new Date(entries[0].createdAt).toISOString(),
      entries[0].createdAt,
    );
  });

  test("trims whitespace", async () => {
    await submitEntry({ name: "  Ada ", message: " hi \n" }, "1.2.3.4");
    const [entry] = await recentEntries();
    assert.equal(entry.name, "Ada");
    assert.equal(entry.message, "hi");
  });

  test("silently drops honeypot submissions", async () => {
    const result = await submitEntry({ ...note, website: "x" }, "1.2.3.4");
    assert.deepEqual(result, { accepted: true, posted: false });
    assert.deepEqual(await recentEntries(), []);
  });

  test("rejects invalid notes", async () => {
    for (const body of [
      {},
      { name: "", message: "hi" },
      { name: "Ada", message: "   " },
      { name: "a".repeat(limits.name + 1), message: "hi" },
      { name: "Ada", message: "a".repeat(limits.message + 1) },
      { name: 5, message: "hi" },
      { name: "Ada", message: "bell\x07" },
    ]) {
      const result = await submitEntry(body, "1.2.3.4");
      assert.equal(
        "error" in result && result.status,
        400,
        JSON.stringify(body),
      );
    }
    assert.deepEqual(await recentEntries(), []);
  });

  test("limits notes per address per hour", async () => {
    for (let i = 0; i < limits.perAddressPerHour; i++)
      assert.equal((await submitEntry(note, "1.2.3.4")).posted, true);
    const limited = await submitEntry(note, "1.2.3.4");
    assert.equal("error" in limited && limited.status, 429);
    assert.equal((await submitEntry(note, "5.6.7.8")).posted, true);
  });

  test("an address can post again after an hour", async () => {
    for (let i = 0; i < limits.perAddressPerHour; i++)
      await submitEntry(note, "1.2.3.4");
    await pg.query(
      "UPDATE guestbook_entries SET created_at = now() - interval '61 minutes'",
    );
    assert.equal((await submitEntry(note, "1.2.3.4")).posted, true);
  });

  test("limits notes from everyone per hour", async () => {
    await seed(limits.totalPerHour);
    const limited = await submitEntry(note, "1.2.3.4");
    assert.equal("error" in limited && limited.status, 429);

    await pg.query("TRUNCATE guestbook_entries");
    await seed(limits.totalPerHour, "2 hours");
    assert.equal((await submitEntry(note, "1.2.3.4")).posted, true);
  });

  test("never stores raw addresses and forgets hashes after a day", async () => {
    await submitEntry(note, "203.0.113.9");
    const [stored] = await rows("SELECT address_hash FROM guestbook_entries");
    assert.match(stored.address_hash, /^[0-9a-f]{64}$/);
    assert.ok(!stored.address_hash.includes("203.0.113.9"));

    await pg.query(
      "UPDATE guestbook_entries SET created_at = now() - interval '2 days'",
    );
    await submitEntry(note, "198.51.100.1");
    const hashes = await rows(
      "SELECT address_hash FROM guestbook_entries ORDER BY id",
    );
    assert.equal(hashes[0].address_hash, null);
    assert.notEqual(hashes[1].address_hash, null);
  });
});

describe("recentEntries", () => {
  test("shows only the newest entries", async () => {
    await seed(limits.shown + 5, "2 hours");
    const entries = await recentEntries();
    assert.equal(entries.length, limits.shown);
    assert.equal(entries[0].id, limits.shown + 5);
    assert.equal((await recentEntries(3)).length, 3);
  });
});

describe("removeEntry", () => {
  test("deletes one entry", async () => {
    await submitEntry(note, "1.2.3.4");
    await submitEntry({ name: "Spam", message: "buy now" }, "5.6.7.8");
    assert.equal(await removeEntry(2), true);
    assert.equal(await removeEntry(2), false);
    assert.equal(await removeEntry(99), false);
    assert.deepEqual(
      (await recentEntries()).map((entry) => entry.name),
      ["Ada"],
    );
  });
});

describe("api/guestbook", () => {
  const post = (body, headers = {}) =>
    POST(
      new Request("https://reedpen.site/api/guestbook", {
        method: "POST",
        headers: {
          host: "reedpen.site",
          origin: "https://reedpen.site",
          "content-type": "application/json",
          "x-real-ip": "1.2.3.4",
          ...headers,
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  test("posts a note from the site", async () => {
    const response = await post(note);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { accepted: true });
    assert.equal((await recentEntries()).length, 1);
  });

  test("rejects other origins", async () => {
    for (const origin of ["https://evil.example", "null", ""]) {
      const response = await post(note, { origin });
      assert.equal(response.status, 403, origin);
    }
    assert.deepEqual(await recentEntries(), []);
  });

  test("rejects malformed requests", async () => {
    assert.equal((await post("{")).status, 400);
    assert.equal((await post("[]")).status, 400);
    assert.equal(
      (await post(note, { "content-type": "text/plain" })).status,
      400,
    );
    assert.equal(
      (await post({ ...note, message: "a".repeat(5000) })).status,
      400,
    );
  });

  test("reports validation and rate-limit errors", async () => {
    const invalid = await post({ name: "", message: "" });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /name and message/);

    for (let i = 0; i < limits.perAddressPerHour; i++) await post(note);
    const limited = await post(note);
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error, /Too many notes/);
  });

  test("lists entries with edge caching", async () => {
    await post(note);
    const response = await GET();
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("vercel-cdn-cache-control"),
      /max-age=3600/,
    );
    const { entries } = await response.json();
    assert.deepEqual(
      entries.map((entry) => entry.name),
      ["Ada"],
    );
  });
});
