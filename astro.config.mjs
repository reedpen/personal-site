import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  markdown: {
    // Prism emits class names, which the site's CSS colors. Shiki's inline
    // style attributes would be blocked by the server's content security policy.
    syntaxHighlight: "prism",
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
