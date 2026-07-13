# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through [GitHub Security Advisories](https://github.com/reedpen/personal-site/security/advisories/new). Do not include exploit details, credentials, or sensitive logs in a public issue.

Include the affected path or component, reproduction steps, impact, and any suggested mitigation. You can expect an initial response within seven days.

## Credential safety

This project does not require runtime credentials. Keep deployment tokens, SSH keys, DNS credentials, and registry credentials in the hosting platform's secret store, never in this repository or a Docker build argument.

- Use narrowly scoped credentials with an expiration date.
- Never paste credentials into issues, pull requests, screenshots, build logs, or Compose files.
- Keep local values in ignored `.env` files only when a deployment tool requires them.
- If a credential is exposed, revoke and replace it immediately; deleting it from Git history is not sufficient.
- Review dependency alerts and secret-scanning findings before deployment.

The production container is designed to run without secrets, without root privileges, and without a writable application filesystem.
