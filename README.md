# Personal site

A personal site built with [Astro](https://astro.build/) and [WebTUI](https://webtui.ironclad.sh/). Astro builds the pages, and a Vercel function provides the guestbook.

Professional content is shared structured data, ready for the website and future résumé tooling.

## Requirements

- Node.js 22.12 or newer
- pnpm 12.4.2

Install the pinned pnpm release through your operating system package manager or with:

```sh
npm install --global pnpm@12.4.2
```

## Local development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Useful checks:

```sh
pnpm check
pnpm format:check
pnpm test
pnpm build
```

The production pages are generated in `dist/`. `pnpm test` runs shared-data tests in temporary directories and guestbook tests against an in-memory Postgres database, so it needs no database account.

## Update site content

Professional details live in [`src/data/profile.yaml`](src/data/profile.yaml) (identity, education, experience, skills) and one YAML file per project in [`src/data/projects/`](src/data/projects/). The shared loader is [`src/lib/portfolio.mjs`](src/lib/portfolio.mjs).

- `site` is the public on/off switch; projects default to hidden, experience to visible.
- `resume` selects résumé entries; projects default to excluded, experience to included.
- `autoSummary` defaults to true and allows missing project summary, bullets, or technologies to use [`src/data/projects.generated.json`](src/data/projects.generated.json). Set it to false to ignore generated text. Manual fields always win, including empty lists. Visible or résumé projects require a summary or bullets.
- Project links use `url` when provided, otherwise `https://github.com/<repo>`. `order` sorts projects first, then title; omitted order sorts last.

[`src/data/stack.yaml`](src/data/stack.yaml) controls project-driven technology stack additions, aliases, categories, and hidden items; `pnpm projects stack` shows the result. Résumé skills stay on `profile.yaml` unless opted in.

Two guides cover the automation built on this data:

- [`docs/projects.md`](docs/projects.md): `pnpm projects` switches projects on or off, discovers new GitHub repositories, and refreshes generated summaries with Codex or OpenCode.
- [`docs/resume.md`](docs/resume.md): the one-page résumé PDF at `/resume.pdf` is generated from the same data on every build. Preview it with `pnpm resume`.

[`src/data/site.ts`](src/data/site.ts) keeps page metadata, navigation, blog/feed settings, introduction, about, contact, and footer text. Components omit empty optional content.

Keep `metadata.canonicalUrl` set to the final public URL. If you add a social-card image, use a public path such as `/social-card.png`. Optional `socialTitle` and `socialDescription` values can override the document metadata for Open Graph and Twitter cards.

### Add ASCII art

Set `introduction.asciiArt` to a template string:

```ts
asciiArt: String.raw`
 __   __
|  | |  |
`,
```

It remains preformatted and scrolls horizontally on small screens.

## Theme and font

[`src/styles/caelus.css`](src/styles/caelus.css) maps the Caelus palette into WebTUI variables. The primary mappings are:

| Caelus role                | WebTUI variable                                                 |
| -------------------------- | --------------------------------------------------------------- |
| Background                 | `--background0`                                                 |
| Surface and raised surface | `--background1`, `--background2`                                |
| Border                     | `--background3`, `--box-border-color`, `--separator-color`      |
| Primary and muted text     | `--foreground0`, `--foreground1`                                |
| Accent/status colors       | `--red`, `--green`, `--yellow`, `--blue`, `--magenta`, `--cyan` |

[`src/styles/fonts.css`](src/styles/fonts.css) owns font loading and the font stack. [`src/styles/global.css`](src/styles/global.css) contains layout and component styling.

JetBrains Mono is bundled from `@fontsource/jetbrains-mono`. A pinned Symbols Nerd Font webfont provides the fallback expected by WebTUI without using the plugin's remote `latest` URL. Visitors do not contact a font CDN.

To switch to another self-hosted monospace font:

1. Replace the Fontsource dependency in `package.json`.
2. Replace the two Fontsource imports at the top of `fonts.css`.
3. Change the first family in `--font-family` in `fonts.css`.

No Astro component needs to change.

Font licenses and pinned asset provenance are recorded in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Guestbook

Visitors can leave a name and a message, which appears on the site immediately. The 50 newest entries are shown, and messages are displayed as plain text, not HTML, so links are not clickable. To limit spam, a hidden honeypot field catches simple bots, each address can post five notes an hour, and the whole guestbook accepts 30 notes an hour.

The guestbook API is the Vercel function in [`api/guestbook.js`](api/guestbook.js). Entries are stored in a [Neon](https://neon.com/) Postgres database. Raw IP addresses are never stored: the per-address limit uses a hash, which is erased after a day.

### Set up the database

1. In the Vercel project, open **Storage**, create a **Neon** Postgres database on the free plan, and connect it to the project. This adds `DATABASE_URL` to the project's environment variables.
2. Optionally, add a `GUESTBOOK_SALT` environment variable set to a long random value, such as the output of `openssl rand -hex 32`. It makes address hashes harder to reverse.
3. Link this folder and download the environment variables:

   ```sh
   pnpm dlx vercel link
   pnpm dlx vercel env pull .env.local --environment=production
   ```

   `--environment=production` is needed because the Neon integration adds its variables to the Preview and Production environments only.

4. Create the table:

   ```sh
   pnpm guestbook setup
   ```

### Remove entries

```sh
pnpm guestbook list        # the 20 newest entries, with their IDs
pnpm guestbook list 100    # more entries
pnpm guestbook remove 7    # remove entry #7
pnpm guestbook remove 7 8  # remove several
```

`remove` deletes the entries and clears Vercel's cached copy of the list, so they disappear from the site immediately. These commands read `DATABASE_URL` from the ignored `.env.local` file.

### Staying on the free tier

The list of entries is cached at Vercel's edge, so page views do not query the database. The cache is cleared whenever someone posts or you remove an entry, and otherwise expires after an hour. Neon's free compute pauses after a few minutes without queries, so the database runs only briefly around new posts and keeps well within the free allowance. If clearing the cache ever fails, changes still appear within an hour.

To try the guestbook locally, run `pnpm dlx vercel dev`. `pnpm dev` serves the site without the API, so the guestbook shows that entries are unavailable.

## Deployment

The site deploys to Vercel from GitHub. Vercel builds the Astro site as static files and deploys `api/guestbook.js` as a function. [`vercel.json`](vercel.json) applies the content security policy and related security headers, caches fingerprinted Astro assets immutably, and serves the RSS feeds with the RSS content type.

## Credential safety

The only runtime secret is `DATABASE_URL`, which Vercel stores. Never commit it or paste it elsewhere.

- Store deployment, database, and DNS credentials in your platform's secret store.
- Prefer narrowly scoped, expiring credentials.
- Keep local environment values in ignored `.env.local` files.
- Never paste secrets into issues, pull requests, screenshots, or logs.
- Revoke an exposed credential immediately; removing it from a later commit is not enough. For the database, reset the Neon password and pull the new `DATABASE_URL`.

See [`SECURITY.md`](SECURITY.md) for private vulnerability reporting and the full repository policy.

## Blogs

The site has two Markdown blogs:

| Blog  | Route     | Posts live in        |
| ----- | --------- | -------------------- |
| Tech  | `/tech/`  | `src/content/tech/`  |
| Media | `/media/` | `src/content/media/` |

Each blog's heading and description are in `blogs` in [`src/data/site.ts`](src/data/site.ts). The file name becomes the URL, so `src/content/tech/my-post.md` is published at `/tech/my-post/`.

A blog's navigation link appears only after it has at least one published post. Posts with `draft: true` appear in `pnpm dev` and are left out of production builds. Each folder contains an example draft that shows every supported field.

### Tech post

```md
---
title: Post title
description: One sentence for the post list and social cards.
date: 2026-11-11
updated: 2026-11-20 # optional
tags: [linux, python] # optional
draft: true # optional; remove to publish
---

Markdown body.
```

### Book or movie post

```md
---
title: The Left Hand of Darkness
description: One sentence for the post list and social cards.
date: 2026-11-11
kind: book # book or movie
creator: Ursula K. Le Guin # author or director
released: 1969 # optional
rating: 4 # optional, 1–5
---

Markdown body.
```

### RSS feeds

| Feed             | Contents              |
| ---------------- | --------------------- |
| `/rss.xml`       | Posts from both blogs |
| `/tech/rss.xml`  | Tech posts            |
| `/media/rss.xml` | Media posts           |

Feeds include each post's full text and use `metadata.canonicalUrl` for absolute links, so keep that value correct. Every page advertises the combined feed for feed-reader discovery, and blog pages also advertise their own feed and show an `[rss]` link. The combined feed's title and description are in `feed` in `site.ts`. Use absolute URLs for links and images inside posts so they also work in feed readers.

Frontmatter is validated by [`src/content.config.ts`](src/content.config.ts), so `pnpm check` and `pnpm build` report missing or invalid fields.

Code blocks are highlighted with Prism, which uses CSS classes colored with the Caelus palette in `global.css`. The site does not use Astro's default Shiki highlighter because its inline styles are blocked by the site's content security policy.

## Project decisions

- [`docs/SITE-SPEC.md`](docs/SITE-SPEC.md) contains the approved implementation specification.
- [`CONTEXT.md`](CONTEXT.md) defines the project's canonical language.
- [`docs/adr/0001-use-astro-for-a-static-zero-javascript-site.md`](docs/adr/0001-use-astro-for-a-static-zero-javascript-site.md) records the static Astro decision.
- [`docs/adr/0002-host-on-vercel-with-a-neon-guestbook.md`](docs/adr/0002-host-on-vercel-with-a-neon-guestbook.md) records the move from a self-hosted container to Vercel.
