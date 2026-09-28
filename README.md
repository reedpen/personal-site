# Personal site

A personal site built with [Astro](https://astro.build/) and [WebTUI](https://webtui.ironclad.sh/). Astro builds the page, while a small Node server provides a moderated guestbook.

The current site content is maintained in one typed data module so it can be kept in sync with the owner's résumé.

## Requirements

- Node.js 26 or newer
- pnpm 12.4.2
- Docker with Compose, if you want the production container

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
pnpm build
```

The production page is generated in `dist/`. The Node server serves those files and the guestbook API. To try the guestbook locally, run `pnpm build`, then `DATA_DIR=./.local-data node server/index.mjs` and open `http://127.0.0.1:8080/`. Rebuild after changing Astro files. The Astro development server does not proxy the API route.

## Update site content

All personal content lives in [`src/data/site.ts`](src/data/site.ts). Edit that file to change:

- Page metadata and author
- Header label and navigation
- Name, role, summary, and profile links
- About paragraphs
- Experience and projects
- Education and highlights
- Categorized technology stack
- Contact details and footer

Optional fields can be deleted. Components do not render empty ASCII art, statuses, links, locations, or highlights.

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

Visitors can leave a name and a message. Submissions remain private until you approve them. The server stores them in a SQLite database in the `guestbook-data` Compose volume. Only the 50 newest approved entries are shown. A honeypot and per-address submission limit reduce spam; approval is the final gate. The message is displayed as plain text, not HTML.

If the site runs behind a trusted reverse proxy, set `TRUST_PROXY=1` in `.env` and configure that proxy to overwrite `X-Forwarded-For` with the real client address. Otherwise the submission limit uses the direct connection address, which may be shared by all visitors behind a proxy.

Review pending entries on the host running Compose:

```sh
docker compose exec site node scripts/guestbook.mjs list
docker compose exec site node scripts/guestbook.mjs approve 1
docker compose exec site node scripts/guestbook.mjs reject 2
```

Back up the `guestbook-data` volume to preserve messages.

## Production container

Build and run the hardened Compose service:

```sh
docker compose up --build -d
```

The site is available on `127.0.0.1:8080` by default, and `GET /health` reports container health. Set `SITE_BIND_ADDRESS` to another host address if an external proxy needs to reach it. The runtime image:

- Runs Node.js as its unprivileged `node` user
- Contains only the built site, API server, and guestbook moderation command
- Drops Linux capabilities and blocks privilege escalation in Compose
- Uses a read-only filesystem with a small temporary filesystem
- Revalidates HTML and caches fingerprinted Astro assets immutably
- Applies a restrictive content security policy and related response headers

Connect a reverse proxy or hosting platform to container port `8080`. TLS, HSTS, DNS, domains, and public ingress intentionally remain outside this repository, so the same image can run at home, on a VPS, or on a container service.

## Credential safety

The guestbook needs no runtime secrets. Do not add credentials to the image, source data, or Docker build arguments.

- Store deployment, registry, DNS, and SSH credentials in your platform's secret store.
- Prefer narrowly scoped, expiring credentials.
- Keep local environment overrides in ignored `.env` files.
- Never paste secrets into issues, pull requests, screenshots, or logs.
- Revoke an exposed credential immediately; removing it from a later commit is not enough.

See [`SECURITY.md`](SECURITY.md) for private vulnerability reporting and the full repository policy.

## Future blog

No blog route or dead navigation link ships today. When posts are needed, add an Astro content collection for Markdown or MDX and reuse the existing layout and metadata. Add visible blog navigation only after an index and at least one published post exist.

## Project decisions

- [`docs/SITE-SPEC.md`](docs/SITE-SPEC.md) contains the approved implementation specification.
- [`CONTEXT.md`](CONTEXT.md) defines the project's canonical language.
- [`docs/adr/0001-use-astro-for-a-static-zero-javascript-site.md`](docs/adr/0001-use-astro-for-a-static-zero-javascript-site.md) records the static Astro decision.
