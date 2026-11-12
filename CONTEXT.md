# Personal Site

This context describes the public-facing personal site and the information it presents. The site exists as a durable professional home base rather than only a project gallery or résumé.

## Language

**Professional home base**:
The public site that establishes the owner's identity, current focus, notable work, background, and preferred contact path.
_Avoid_: Portfolio, résumé site

**Introduction**:
The compact opening that names the owner, states their role, summarizes their focus, and links to relevant external profiles.
_Avoid_: Hero

**About**:
One or two short passages that add personal background, interests, and current focus beyond the Introduction.
_Avoid_: Biography

**Selected work**:
A curated set of projects, roles, or other professional efforts that best represent the owner's experience.
_Avoid_: Projects, employment history

**Education entry**:
A period of study identified by institution, credential, dates, and optional highlights.
_Avoid_: School item

**Stack category**:
A named group of technologies the owner wants to associate with their work, such as languages, frameworks, tools, or platforms.
_Avoid_: Skill level, proficiency score

**Contact prompt**:
The closing invitation to contact the owner through email or an external profile.
_Avoid_: Contact form

**Site content**:
The owner-controlled text, links, metadata, work entries, education entries, and stack categories presented by the site.
_Avoid_: Page copy, hard-coded content

**ASCII art**:
An optional owner-supplied text illustration used as the site's only personal imagery. It is absent until explicitly populated.
_Avoid_: Logo, profile image

**Placeholder content**:
Temporary Lorem Ipsum content included to exercise the complete layout before the owner supplies Site content.
_Avoid_: Seed data, demo content

**Tech blog**:
Dated Markdown posts about software, systems, and tools, published under `/tech/`.
_Avoid_: Dev log, articles

**Media blog**:
Dated Markdown posts about books and movies, published under `/media/`. Each post names its kind, its creator, and optionally its release year and a rating out of five.
_Avoid_: Reviews section, reading list

**Draft**:
A post marked `draft: true`, visible during local development and omitted from production builds.
_Avoid_: Unpublished post

**Shared professional data**:
The profile and project YAML files loaded by `src/lib/portfolio.mjs` for the site and future résumé tooling. Manual project text takes precedence over generated text.
_Avoid_: Duplicated résumé content

**Project visibility**:
The `site` switch controls public display; `resume` independently selects résumé inclusion. `autoSummary` permits generated text to fill fields the owner has not written.
_Avoid_: Automatic publishing
