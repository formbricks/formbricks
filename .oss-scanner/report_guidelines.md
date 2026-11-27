# How we would like reports written

## Layout and length

One report per root cause, under one page unless the reproduction genuinely needs
more. Sections, in this order:

1. **Title** — `component: short description` (for example `api/v3: cross-workspace read in response export`).
2. **Summary** — what is wrong and why it matters, in two or three sentences.
3. **Affected code** — file paths and function names, plus the deployment
   configuration the finding needs (self-hosted or Cloud, feature flags, plan).
4. **Attacker starting position** — anonymous, or an organization role
   (`owner`, `manager`, `member`, `billing`, `dashboard_viewer`) plus, for a
   `member` or `dashboard_viewer`, the team permission on the target workspace
   (`read`, `readWrite`, `manage`); or an API key with its workspace and
   organization permissions; or an MCP client with its grant (selection and
   access levels) and consented scopes.
5. **Reproduction** — the smallest sequence that demonstrates the issue:
   request(s), payload, test, or code excerpt. Prefer a runnable unit test.
6. **Impact** — what the attacker gains, and which tenant or role boundary is
   crossed.
7. **Suggested fix** — the change you would make, in one or two sentences.

## What every report should state

- Whether the bug is reachable unauthenticated.
- The exact endpoint or UI route that reaches the faulty code.
- Which boundary it crosses (anonymous → user, user → user, organization →
  organization, into an unreached workspace of the same organization, role,
  team-permission, API-key or MCP grant escalation) or that it is contained in
  one workspace.
- Any precondition: an enabled feature, a configured integration, a non-default
  environment variable.

## Style

- Plain Markdown, no tables, no screenshots of code.
- Name components the way the repository does (`@formbricks/web`,
  `api/v1/client`, `packages/database`).
- Do not include real customer data, tokens or personal information in a report;
  redact secrets and use synthetic values.
