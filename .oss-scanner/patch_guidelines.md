# How we would like patches made

Patches arrive as a diff inside the emailed report, and we apply them
ourselves after triage. The scanner never opens pull requests.

## Size and scope

- As narrow as the bug allows: change the faulty function and its direct
  callers, not the surrounding module. No drive-by refactors, renames or
  formatting churn.
- If the same mistake is repeated across sibling handlers, fix the shared helper
  once instead of patching each call site.
- Do not add dependencies. Do not change database migrations unless the
  vulnerability requires it.
- Keep the existing tenant scoping and authorization helpers
  (`apps/web/lib/authorization`, `apps/web/lib/workspace/auth.ts`,
  `apps/web/lib/authzed`, `apps/web/modules/api/lib/api-key-auth.ts`); a
  patch that bypasses them
  is not acceptable even if it fixes the symptom.

## Code style

- TypeScript. Format only the files you change
  (`pnpm exec prettier --write <files>`) and keep oxlint clean
  (`pnpm turbo run lint:code -- --quiet`).
- Comments only where the fix is not self-evident; match the surrounding style.
- Prefer existing utilities and error types over new ones.

## Tests

- Add a regression test next to the code under test, as a vitest `.test.ts` file
  (the repository does not colocate tests for `.tsx` components). The test must
  fail before the fix and pass after it.
- Unit tests only. Playwright/E2E and integration tests need Postgres, Redis and
  SpiceDB and cannot run in the scanner environment.
- For auth and tenant-boundary fixes, cover both the allowed and the denied
  case (a member of workspace A must not read workspace B's resource).

## Branch and commit message

- Branch from `main`; keep the patch applicable to current `main`.
- Conventional Commits, for example `fix(api): scope response export to the
caller's workspace`. No ticket id is required for a scanner patch.
