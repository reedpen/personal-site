# Project automation

Run commands from the checkout with Node ≥ 22.12 and pnpm. `list`, `help`, and
visibility changes work offline. Discovery and refresh use your authenticated
GitHub CLI (`gh auth login`); refresh also uses Git and your locally authenticated
Codex CLI with your ChatGPT plan (`codex login`), or the OpenCode CLI (tested
with v2.2.7). OpenCode free models need no login. No API tokens are stored in code.

```sh
pnpm projects help
pnpm projects list
pnpm projects discover --dry-run
pnpm projects discover
pnpm projects refresh --dry-run
pnpm projects refresh
```

## Commands

- `list`: show every project's slug, site/resume/automatic switches, repository,
  text source (`manual`, `generated`, `manual+generated`, or `missing`), and the
  first eight characters of its generated commit.
- `public <slug...>` / `hide <slug...>`: turn website visibility on or off.
- `resume <on|off> <slug...>`: select projects for the résumé independently of
  website visibility.
- `auto <on|off> <slug...>`: set `autoSummary`. Turning this off also tells the
  shared loader to ignore cached generated text. It does not delete the cache.
- `discover [--dry-run]`: add repositories selected by policy. Existing `repo`
  values match case-insensitively. Titles come from repository names. New files
  contain visibility switches and `autoSummary: true`, with no written text.
  Slug collisions get a numeric suffix; existing files are never overwritten.
- `refresh [slug...] [--force] [--dry-run] [--jobs N] [--provider codex|opencode]`: refresh all tracked projects
  or the named subset. Projects without `repo`, or with `autoSummary: false`, are
  skipped, including when explicitly named. Matching repository and cached head
  commit skip generation unless `--force` is set. `--jobs` is a positive integer
  and defaults to 2. Each project's failure is reported independently; any
  failure makes the command exit nonzero. Successful entries are retained even
  when another project fails.

Unknown slugs produce an error listing valid names. Toggle commands use YAML
Documents to preserve owner comments and scalar styles; YAML serialization may
normalize incidental whitespace.

Dry runs fetch GitHub metadata but create no files, clone no repositories, and
never run a model CLI. Refresh prints refreshed/unchanged/skipped/failed counts; in a
dry run, “refreshed” means “would refresh.” It then validates the portfolio and
reports all site/resume-enabled projects that still have no summary or bullets.

## Policy

Edit [`src/data/projects.config.yaml`](../src/data/projects.config.yaml). It is
validated with Zod; unknown keys and invalid values are errors.

| Option                  | Default                             | Meaning                                                                                                                  |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `owner`                 | `reedpen`                           | GitHub account used by discovery. Refresh uses each project's explicit `repo`.                                           |
| `discover`              | `pinned`                            | `pinned`: owner's pinned repositories; `public`: owned public non-fork, non-archived repositories; `none`: no discovery. |
| `newProjects`           | `{ site: false, resume: false }`    | Visibility switches on discoveries. Keep both false to review new projects before publishing.                            |
| `includePrivate`        | `false`                             | Permit cloning and summarizing private repositories globally.                                                            |
| `provider`              | `codex`                             | CLI provider: `codex` or `opencode`.                                                                                     |
| `opencode.model`        | `opencode/deepseek-v4.1-flash-free` | OpenCode model in `provider/model` format.                                                                               |
| `codex.model`           | `gpt-6.1-sol`                       | Codex model.                                                                                                             |
| `codex.reasoningEffort` | `medium`                            | Codex reasoning effort (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`, subject to model support).        |
| `maxBullets`            | `3`                                 | Maximum generated résumé bullets, from 1 to 10.                                                                          |

Provider blocks have defaults, including when omitted. For example:

```yaml
provider: codex # codex | opencode
codex:
  model: gpt-6.1-sol
  reasoningEffort: medium
opencode:
  model: opencode/deepseek-v4.1-flash-free
```

Use `refresh --provider opencode` or `stack classify --provider opencode` to
override the provider for one run without editing policy. A refresh override also
applies to its automatic stack classification. Unknown providers are errors.
Changing providers does not invalidate cached summaries; use `--force` if needed.

Free models may be rate limited and change over time. Their terms may allow
prompts to be logged or used for training. Repositories summarized are public by
default because `includePrivate` is false; per-project `allowPrivate` can override
that default.

Pinned discovery follows the owner's pins, which can include repositories owned
by other accounts. Public discovery paginates through all owned public repos.
Changing policy or prompt does not automatically invalidate cached commits; use
`--force` to regenerate unchanged projects.

## Manual and generated text

Each project lives in `src/data/projects/<slug>.yaml`. Manually supplied
`summary`, `bullets`, and `technologies` each override the corresponding generated
field, independently. An explicit empty list also wins. Delete `summary` and/or
`bullets` from a project's YAML to let the generator own those fields; remove
`technologies` if you want that field generated too. Keep `autoSummary: true`.
Visibility changes do not generate text. Enabled projects need a summary or at
least one bullet before the site or résumé can build.

Generated content lives in `src/data/projects.generated.json`, validated against
the shared generated-file schema. Refresh preserves entries it did not update,
sorts slug keys, and writes the file once at the end using an atomic replacement.
Each entry records the repository, commit, timestamp, model, pushed timestamp,
private flag, and generated text. Refresh does not change the project's manual
text or visibility.

The editable prompt is in `scripts/lib/projects-prompt.mjs`. It asks the model to read
the README and code, produce one summary sentence of at most 30 words, 1–maxBullets
past-tense technical bullets of at most 35 words each, and at most eight actual
technologies. Two owner-written project bullets are loaded at runtime as style
examples, preferring résumé-selected projects. Sparse fixtures with fewer than
two written bullets use what is available. The prompt forbids invented numbers,
users, outcomes, and marketing claims. JSON structure and word limits are
validated locally; review factual accuracy yourself.

## Technology stack

[`src/data/stack.yaml`](../src/data/stack.yaml) controls automatic additions from
site-visible projects' effective `technologies`: manual values win over generated
values, including empty arrays. The file is optional; a missing file uses the
defaults below. Unknown policy keys, unknown profile skill labels, and conflicting
category/hide assignments fail validation with the file and field.

| Option         | Default | Meaning                                                                                                                                                                    |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fromProjects` | `true`  | Add categorized technologies used by site-visible projects.                                                                                                                |
| `minProjects`  | `1`     | Minimum distinct site-visible projects using a technology before it is added.                                                                                              |
| `resume`       | `false` | Use the merged stack in the résumé when true. Otherwise keep exactly `profile.yaml` skills to preserve the one-page résumé.                                                |
| `aliases`      | `{}`    | Map variants to canonical spellings, e.g. `Postgres: PostgreSQL`. Matching trims whitespace and ignores case, including category labels.                                   |
| `hide`         | `[]`    | Technologies never auto-added. Owner-written profile skills are always retained.                                                                                           |
| `categories`   | `{}`    | Map profile skill labels to lists of technologies to file there. A technology cannot belong to two categories or to both a category and `hide`, after alias normalization. |

Profile skills keep their categories, items, spelling, and order. Automatic items
are appended within their categories, sorted by project count descending, then
alphabetically ignoring case. An alias target supplies the automatic item's
spelling; otherwise the category entry does. Each project counts at most once
per canonical technology. Hidden projects and résumé-only projects do not count.
Uncategorized technologies stay off the stack until reviewed, and remain listed
for review even below `minProjects` or with `fromProjects: false`.

```sh
pnpm projects stack
pnpm projects stack hide "calcium imaging" postpyc
pnpm projects stack show postpyc
pnpm projects stack add "Frameworks/Libraries" Streamlit LibVoikko
pnpm projects stack add "Tools/Platforms" SQLite
pnpm projects stack classify --dry-run
pnpm projects stack classify
```

`stack` prints the computed site stack with project counts on automatic items,
then uncategorized technologies and their project slugs, then hidden items.
`hide` moves technologies out of categories into `hide`; `show` removes them from
`hide` and reports if they still need a category. `add` moves them out of `hide`
and any previous category into the specified profile skill label. Quote names
and labels that contain spaces. These commands work offline, preserve YAML
comments using the Document API, and replace `stack.yaml` atomically. They create
the policy file when needed.

`classify` sends all uncategorized technologies to the configured provider, using
its settings in `projects.config.yaml`. The prompt includes profile
skill labels with existing items as examples and technologies with project
titles. The model returns `{assignments: [{technology, category}]}` with each category
restricted to a profile skill label or `hide`. Internal/unpublished packages,
research concepts, and misspellings belong in `hide`. Unrequested technologies
are ignored; missing or duplicate assignments and invalid categories fail before
writing. The call runs read-only in a temporary directory; classification clones
no repository. Codex uses `--output-schema`, `--ephemeral`, and
`--skip-git-repo-check`. OpenCode uses the permission configuration below.
Temporary files are removed on success or failure. `--dry-run` lists what needs
classification without calling a model CLI or writing files.

After a non-dry-run `refresh` successfully refreshes at least one project, it
classifies any uncategorized site technologies and prints the assignments. A
classification failure makes refresh exit nonzero while keeping successfully
refreshed summaries. Unchanged, skipped, failed-only, and dry-run refreshes do
not trigger classification. Review `git diff` after classification as well as
after refresh.

## Private repositories

Refresh checks GitHub metadata before fetching a head commit or cloning.
When `includePrivate: false`, private repositories are skipped unless their
project YAML explicitly has `allowPrivate: true` (default false). `--force` does
not override this rule. Discovery may track a private pin, but does not clone or
summarize it. Visibility is independent: enabling private-repo generation can
put its generated text into this checkout and, if enabled, onto the website or
résumé. Review the output before publishing.

## External commands and review

All process execution goes through the injectable runner in
`scripts/lib/projects-runner.mjs`. Tests use fakes and temporary fixtures, with no
real GitHub or model CLI calls. These are the actual argument sequences (placeholders
stand for runtime values, not literal shell substitutions):

```text
gh api graphql -f 'query=query($owner: String!) {
  user(login: $owner) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes { ... on Repository { nameWithOwner isPrivate isFork isArchived owner { login } } }
    }
  }
}' -f owner=<owner>
gh api --paginate --slurp 'users/<owner>/repos?type=owner&per_page=100'
gh api repos/<owner>/<repo>
gh api repos/<owner>/<repo>/commits/<URL-encoded-default-branch>
gh repo clone <owner>/<repo> <temp>/repo -- --depth 1 --branch <default-branch>
git -C <temp>/repo rev-parse HEAD
codex exec -m <model> -c model_reasoning_effort=<effort> -s read-only -C <temp>/repo --skip-git-repo-check --ephemeral --output-schema <temp>/schema.json -o <temp>/output.json '<prompt>'
opencode run -m <provider/model> --format json --archived '<prompt-with-schema>'
```

The tool passes arguments directly without a shell. Codex runs read-only in a
shallow clone. OpenCode runs with cwd set to the shallow clone for refresh or a
temporary directory for classification. Before launching OpenCode, refresh removes
`opencode.json`, `opencode.jsonc`, and `.opencode/` from the clone root and writes
this `opencode.json` (classification writes it into its temporary directory):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "deny",
    "read": "allow",
    "glob": "allow",
    "grep": "allow",
    "list": "allow"
  }
}
```

This leaves only read/list/glob/grep access; shell, editing, web access, and
external directories are removed. OpenCode receives the JSON Schema in the
prompt, and the adapter reads text from the final stopped step of JSONL output.
It accepts fenced JSON or prose around the object and validates locally. Parsing
or schema validation failures get one retry with the validation error; process
failures and error events fail immediately.

If the branch changes between metadata lookup and cloning, the
project fails with a retry message instead of caching under the wrong commit.
Temporary directories are removed on success and failure. As with any process,
an abrupt termination such as SIGKILL can leave temporary files behind.

`refresh` only edits local files. Review `git diff` before committing; it does not
commit, push, or publish. Repository content and generated prose should be
reviewed as evidence, especially before résumé use.
