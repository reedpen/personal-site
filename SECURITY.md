# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through [GitHub Security Advisories](https://github.com/reedpen/personal-site/security/advisories/new). Do not include exploit details, credentials, or sensitive logs in a public issue.

Include the affected path or component, reproduction steps, impact, and any suggested mitigation. You can expect an initial response within seven days.

## Credential safety

The only runtime credential is the guestbook's `DATABASE_URL`, stored in Vercel's environment variables and pulled into an ignored `.env.local` file for the `pnpm guestbook` command. Keep it, deployment tokens, and DNS credentials in the hosting platform's secret store, never in this repository.

- Use narrowly scoped credentials with an expiration date.
- Never paste credentials into issues, pull requests, screenshots, or build logs.
- Keep local values in ignored `.env` files only when a deployment tool requires them.
- If a credential is exposed, revoke and replace it immediately; deleting it from Git history is not sufficient.
- Review dependency alerts and secret-scanning findings before deployment.
