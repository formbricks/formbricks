# @formbricks/deployment-check

Post-deployment end-to-end health check for a self-hosted Formbricks instance. It talks to the instance over
HTTP and a real browser only — no database access — and cleans up everything it creates.

Operator documentation: [`docs/self-hosting/setup/deployment-check.mdx`](../../docs/self-hosting/setup/deployment-check.mdx).

## Run locally

```bash
FORMBRICKS_URL=http://localhost:3000 \
FORMBRICKS_API_KEY=fbk_... \
FORMBRICKS_WORKSPACE_ID=... \
pnpm --filter @formbricks/deployment-check check
```

First time only: `pnpm --filter @formbricks/deployment-check exec playwright install chromium`.

## Layout

- `checks/` — one spec per tier: `01-infra`, `02-auth`, `03-survey-loop`, `04-storage`, `05-sdk`, plus global setup/teardown.
- `src/` — config parsing, API client, tier gating, survey payloads and diagnostics. Logic lives in `.ts` modules with unit tests; the specs only orchestrate.

Black-box by design: nothing here imports from `apps/web` or `@formbricks/database`, so the Docker image builds standalone.
