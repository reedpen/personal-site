# Personal site

A static, JavaScript-free personal site built with [Astro](https://astro.build/) and [WebTUI](https://webtui.ironclad.sh/). It uses the Caelus color palette, self-hosted JetBrains Mono, and a rootless production container.

The repository currently contains obvious placeholder content. Replace it before publishing.

## Requirements

- Node.js 22.12 or newer
- pnpm 11.12.0
- Docker with Compose, if you want the production container

Install the pinned pnpm release through your operating system package manager or with:

```sh
npm install --global pnpm@11.12.0
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

The production site is generated in `dist/`. Astro and Node.js are build-time tools; the delivered website contains static HTML, CSS, fonts, and the favicon.

## Replace the placeholder content

All personal content lives in [`src/data/site.ts`](src/data/site.ts). Edit that file to change:

- Page metadata and author
- Header label and navigation
- Name, role, summary, and profile links
- About paragraphs
- Selected work
- Education and highlights
- Categorized technology stack
- Contact details and footer

Optional fields can be deleted. Components do not render empty ASCII art, statuses, links, locations, or highlights.

Set `metadata.canonicalUrl` only after you know the final public URL. If you add a social-card image, use a public path such as `/social-card.png`. Optional `socialTitle` and `socialDescription` values can override the document metadata for Open Graph and Twitter cards.

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

## Production container

Build and run the hardened Compose service:

```sh
docker compose up --build -d
```

The site is available on port `8080`, and `GET /health` reports container health. The runtime image:

- Runs Static Web Server as its unprivileged `sws` user
- Contains no Node.js runtime or source files
- Drops Linux capabilities and blocks privilege escalation in Compose
- Uses a read-only filesystem with a small temporary filesystem
- Compresses responses
- Revalidates HTML and caches fingerprinted Astro assets immutably
- Applies a restrictive content security policy and related response headers

Connect a reverse proxy or hosting platform to container port `8080`. TLS, HSTS, DNS, domains, and public ingress intentionally remain outside this repository, so the same image can run at home, on a VPS, or on a container service.

## Credential safety

The website needs no runtime secrets. Do not add credentials to the image, Compose file, source data, or Docker build arguments.

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
