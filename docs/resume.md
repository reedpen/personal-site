# Résumé

Every `pnpm build` generates `public/resume.pdf` before Astro builds the site.
Vercel runs the same command and Astro copies the PDF to `dist/resume.pdf`.
The introduction links to it at `/resume.pdf`. The PDF is generated and ignored
by Git.

`scripts/build-resume.mjs` loads the shared portfolio data and passes JSON through
Typst's `sys.inputs.portfolio`. `resume/resume.typ` decodes it as data and renders
strings directly as content, so Typst syntax in your text stays literal. The
bundled Liberation Sans fonts in `resume/fonts/` keep compilation local and
consistent. No external compiler or network access is required.

Edit `src/data/profile.yaml` for identity, contact links, education, experience,
and skills. Set `resume: false` on an experience entry to exclude it (experience
defaults to included). In `src/data/projects/*.yaml`, set `resume: true` to include
a project (projects default to excluded). The `site` switch controls website
visibility independently. Projects follow the shared loader's ordering and
manual/generated data precedence. Project bullets take priority over the summary;
a summary becomes a single bullet only when there are no bullets.

To preview:

```sh
pnpm resume
```

Then open `public/resume.pdf`. Change the layout in `resume/resume.typ`.

The generator prints the output path and page count. If content overflows to more
than one page, it prints a warning and still writes the PDF. Turn off `resume` on
a project or trim bullets to get back to one page. The real-data résumé test also
checks that the current content fits exactly one page.
