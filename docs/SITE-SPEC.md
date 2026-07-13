# Personal Site Specification

Status: agreed during the grilling session; implementation has not started.

## Product Goal

Build a durable professional home base that quickly establishes who the owner is, what they do, what work and education shaped them, which technologies they use, and how to contact them.

The first release is a single-page site inspired by the restrained terminal presentation of `adam.cm`, but it should have its own visual identity through the Caelus palette, typography, information structure, and details.

## Principles

- Static and dependable: the delivered site is HTML and CSS with no client-side JavaScript.
- Content-first: a visitor should understand the owner before noticing the interface treatment.
- Easy to personalize: all Site content lives in one clearly labeled, typed data module.
- Terminal-inspired, not terminal role-play: use monospace typography and WebTUI structure without fake commands, typing effects, or novelty interactions.
- Portable: the production image serves static files and assumes nothing about the eventual host, domain, TLS terminator, or reverse proxy.

## Information Architecture

The page appears in this order:

1. Static header navigation
2. Introduction
3. About
4. Selected work
5. Education
6. Technology stack
7. Contact prompt
8. Footer

The header uses a configurable name or `~/handle` label followed by visible anchor links for `about`, `work`, `education`, `stack`, and `contact`. It is not sticky and does not collapse into a hamburger menu.

### Introduction

The Introduction contains:

- Name
- One-line role
- One-sentence summary
- Configurable external profile links
- Optional multiline ASCII art

ASCII art is stored with the rest of the Site content and is not rendered when empty. The owner will provide it later.

### About

The About section contains one or two short paragraphs for background, interests, and current focus. It is intentionally separate from the terse Introduction.

### Selected Work

Each entry supports:

- Title
- Date or date range
- Short description
- Optional status badge
- Optional destination URL

The first scaffold contains three unmistakable Lorem Ipsum entries. Screenshots and technology tags are excluded; technologies belong in the stack section.

### Education

Each entry supports:

- Institution
- Program or credential
- Date range
- Optional location
- Optional highlights

The first scaffold contains one Lorem Ipsum entry with two highlights.

### Technology Stack

Technologies are grouped into editable Stack categories rather than presented as one flat list. Placeholder categories are languages, frameworks, tools, and platforms, with labels and items controlled by Site content.

### Contact

Contact is a short closing prompt with a prominent `mailto:` link and configurable external profiles. There is no contact form, server-side submission handler, or client-side validation.

## Content Model

A single typed data module owns:

- Site identity and navigation label
- Page title, description, author, canonical URL, and social metadata
- Introduction and optional ASCII art
- About paragraphs
- External and social links
- Selected Work entries
- Education entries
- Stack categories and items
- Contact prompt and email address
- Footer text

Presentation components consume this data and do not contain personal details. Placeholder content must be conspicuously temporary so it cannot be mistaken for finished copy.

## Visual Direction

### Layout

- Centered, narrow document column of approximately `80ch`
- Spacing expressed primarily in character widths and line heights to align with WebTUI conventions
- Open Introduction, About, Contact, and footer regions
- Square WebTUI boxes with sheared headings around Selected Work, Education, and Technology Stack
- Caelus orange used sparingly for links, focus states, and important labels
- No profile photograph, wallpaper, illustration, or decorative image asset

### Caelus Theme

The custom WebTUI theme is derived from `/home/reedpen/.config/theme/themes/caelus/colors.toml`.

| Role             | Value     |
| ---------------- | --------- |
| Background       | `#0f0f0f` |
| Surface          | `#1e1f1e` |
| Hover surface    | `#272a28` |
| Foreground       | `#f4decd` |
| Muted foreground | `#d9cdb5` |
| Border           | `#3b403c` |
| Accent           | `#ef934d` |
| Warning          | `#f4b585` |
| Error            | `#f16e65` |
| Green            | `#7ec97e` |
| Blue             | `#71b4d6` |
| Magenta          | `#e28dc6` |
| Cyan             | `#7ec9a3` |

These values map into WebTUI's background, foreground, border, and accent variables in a dedicated theme layer. Caelus is the only theme; the site has no light variant or theme switcher.

### Typography

- Self-host JetBrains Mono in regular and bold weights using web-optimized font files.
- Self-host a pinned Symbols Nerd Font file as WebTUI's separate symbol fallback. Do not ship the plugin's remote `latest` font URL.
- Keep font loading and the primary `--font-family` declaration isolated so another monospace face can replace JetBrains Mono without changing components.
- Prefer standard text rendering over programming ligatures unless a concrete design need emerges.

### Interaction

- No entrance animation, typing simulation, blinking cursor, parallax, or scroll effects
- Immediate color changes for hover and keyboard focus
- External links remain ordinary semantic links
- Section navigation uses native fragment links

## Responsive and Accessible Behavior

- Support current desktop and mobile releases of Chrome, Firefox, Safari, and Edge.
- Let the full navigation wrap below the identity label on narrow screens.
- Stack work and education metadata vertically when horizontal space is insufficient.
- Preserve future ASCII art as preformatted text and allow horizontal scrolling rather than shrinking it into illegibility.
- Use semantic landmarks, headings, lists, articles, and address/contact markup where appropriate.
- Provide visible keyboard focus and sufficient contrast within the Caelus palette.
- Respect user font loading behavior and provide a robust system monospace fallback.
- Do not introduce legacy-browser polyfills.

## Metadata and Privacy

Include configurable:

- Document title and description
- Author
- Canonical URL
- Open Graph and social-card title and description
- Optional social-card image field for later use
- Placeholder favicon

Do not include analytics, tracking pixels, cookies, or a consent banner.

## Technical Architecture

- Astro produces static output.
- No Astro island is hydrated and no browser script is emitted by site code.
- pnpm is the package manager and its lockfile is committed.
- Import only the WebTUI base, utilities, and components that the page uses. Provide the Nerd Font symbol fallback locally.
- Keep content, components, theme rules, font rules, and global layout rules in separate modules.
- Use Astro's reusable layout and metadata structure so a future blog can adopt them.

A likely source shape is:

```text
src/
  components/
  data/site.ts
  layouts/
  pages/index.astro
  styles/
    caelus.css
    fonts.css
    global.css
public/
  fonts/
```

The exact component boundaries may be refined during implementation without changing this specification.

## Quality Checks

Provide pnpm scripts for:

- Local Astro development
- Astro type and content checks
- Production build
- Formatting and formatting verification

A dedicated test framework is not required for the first release. Verification should include the static build, Astro checks, and manual responsive inspection in a browser.

## Container and Deployment

Use a multi-stage Docker build:

1. A Node.js build stage installs the locked pnpm dependencies and builds Astro.
2. A rootless Static Web Server Alpine runtime contains only the generated site and server configuration.

Runtime expectations:

- Listen on port `8080` inside the container.
- Expose a native `/health` endpoint for Compose health checks.
- Compress appropriate responses.
- Cache fingerprinted assets for a long duration and make HTML revalidate promptly.
- Apply appropriate content-type, framing, referrer, and permissions headers.
- Leave TLS and HSTS policy to the external ingress layer.
- Run as a non-root user with no application write requirement.

Include a minimal Compose example that builds the image, declares the health check, and exposes the service without Tailscale, cloud-provider, domain, certificate, or reverse-proxy coupling. The same image must be usable on a home server, VPS, or container platform.

## Documentation

The README should explain:

- Required tools and pnpm commands
- How to replace all Placeholder content in the Site content module
- How to add or remove ASCII art
- How the Caelus palette maps into WebTUI variables
- How to build and run the production container and Compose service
- Where an external ingress should connect
- How a future blog can be introduced with Astro content collections
- How to replace JetBrains Mono with another self-hosted monospace font

## Explicit Non-Goals

The first release does not include:

- Blog routes, posts, feeds, or visible blog navigation
- Client-side JavaScript
- A light theme or theme switcher
- Contact form processing
- Analytics or tracking
- Animations or terminal simulations
- Profile photography or image galleries
- Hosting-provider, Tailscale, DNS, TLS, or reverse-proxy configuration
- Legacy-browser support

## Future Blog Direction

When a blog becomes necessary, use Astro content collections and Markdown or MDX content. Reuse the site's layout, metadata, typography, and Caelus theme. Do not display a blog link until at least one published post and an index route exist.

## Acceptance Criteria

- The production HTML contains no site-authored client script.
- Every agreed section renders from the centralized typed Site content module.
- Empty optional fields, including ASCII art, status badges, links, locations, and highlights, do not leave broken or empty UI.
- The initial page contains the agreed amount of obvious Lorem Ipsum content.
- The layout is usable with keyboard navigation and at narrow mobile widths.
- Caelus is the only active theme and JetBrains Mono is served locally.
- Astro checks and the production build pass.
- The container runs as non-root, reports healthy, and serves the generated site on port `8080`.
- The Compose example remains independent of the final hosting and ingress choice.
