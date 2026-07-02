# Security Policy

## Supported versions

Only the latest commit on `main` is actively supported. There are no versioned releases with separate security maintenance windows.

## Reporting a vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Report security issues privately:

- **Email:** mazze@mazzeleczzare.com  
- **Subject line:** `[SECURITY] adaptive-response — <one-line summary>`
- **PGP:** Not currently required. If you want to encrypt, reach out first and we can coordinate.

Expect an acknowledgement within **72 hours**. A fix timeline will be shared after triage.

## Scope

In scope:
- CORS misconfiguration / origin bypass
- Authentication or secret exposure
- Rate-limit bypass
- Schema validation bypass leading to data exposure or injection
- Dependency vulnerabilities with a credible exploit path

Out of scope:
- Issues requiring physical access to the deployment infrastructure
- Theoretical vulnerabilities with no practical exploit
- Cloudflare platform-level issues (report those to Cloudflare directly)

## Disclosure policy

We follow coordinated disclosure. Please allow a reasonable remediation window (typically 14–30 days) before public disclosure. We will credit reporters in the fix commit unless you prefer anonymity.
