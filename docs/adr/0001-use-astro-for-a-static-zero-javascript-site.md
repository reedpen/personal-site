# Use Astro for a static site with no client JavaScript

The site will use Astro as a build-time framework while emitting static HTML and CSS with no client-side JavaScript. This preserves the simplicity, resilience, and privacy of a document-style personal site while providing reusable layouts, typed Site content, and a natural path to Markdown-based blog posts later.

## Considered Options

- Plain HTML and CSS would remove the build step, but would make shared presentation and a future blog more cumbersome.
- A client-rendered framework would add runtime JavaScript without supporting any current requirement.

## Consequences

- Node.js and pnpm are development and build dependencies, not production runtime dependencies.
- Interactive features that require client-side JavaScript are outside the current architecture and must be introduced deliberately.
- The generated site can be hosted by any static file server independently of Astro.
