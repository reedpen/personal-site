# Host on Vercel with a Neon-backed guestbook

The site is hosted on Vercel's free Hobby plan. The guestbook runs as a Vercel function and stores entries in a Neon Postgres database on Neon's free plan. This replaces the self-hosted Node.js container, whose SQLite database needed a persistent volume and a server that was never deployed.

## Considered Options

- Keeping the container would preserve host independence, but it needs a server to run on and maintain, while the site is already served by Vercel.
- Upstash Redis has no compute-hour limit, but SQL keeps the rate-limit queries and the existing data model simple.
- Turso would keep SQLite, but Neon is Vercel's integrated Postgres option and needs no extra account setup.

## Consequences

- The guestbook is unmoderated: notes appear immediately, and spam is limited by a honeypot field and per-address and site-wide hourly limits. Unwanted entries are deleted with `pnpm guestbook remove`.
- The entry list is cached at Vercel's edge under a cache tag that is deleted whenever a note is posted or removed, so the database is queried only after changes. This keeps Neon's compute usage within the free plan.
- `DATABASE_URL` is the site's only runtime secret.
- Security headers live in `vercel.json` instead of the Node server.
- The Dockerfile, Compose file, and Node server were removed; they remain in Git history.
