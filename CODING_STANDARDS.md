# Coding standards

Judgement calls no linter or test can check. Plans are designed to them and reviews hold diffs to them, so a
session settles these without asking. Mechanical rules live in ESLint, Prettier and CI; commands and
repo conventions live in `AGENTS.md`. Where an ADR in `docs/adr/` decides otherwise for its area, the ADR
wins.

## Follow the closest existing pattern

- Before designing a piece, find the feature that already does something similar and build the new one the
  same way: module layout, API shape, UI components, tests.
- Extend what nearly fits (a prop, an option, a parameter) rather than copying it. UI reuses the components of
  similar-looking screens, guided by `.agents/formbricks-context/DESIGN.md` when it exists.
- A bad pattern is the exception: name what is wrong with it and fix it. When the change already touches that
  code, the refactor ships in the same PR as its own commit; otherwise it becomes a Linear ticket.

## APIs

- New endpoints start internal: `/api/internal/<resource>`, session auth, no OpenAPI entry and no stability
  promise. Internal routes are v3 in everything but the contract, so they can change freely while the shape
  settles.
- An endpoint is promoted to public `/api/v3` once an external caller (an API key, an integration, an MCP
  tool that writes) needs it: it gains its OpenAPI contract and stability promise, and the app moves to the
  public route rather than keeping an internal twin. A feature built for external callers from day one
  starts public, as dashboards did ([ADR-0002](docs/adr/0002-the-app-uses-the-public-dashboard-api.md)).
- The route framework and the client helpers are in `AGENTS.md` under "Architecture & Patterns".
- Paths name resources, and each response uses the method and status code HTTP defines for the case. Writes
  that can race take the `updatedAt` compare-and-set (409 on mismatch); writes a retry could repeat are
  idempotent.

## Files in and out

Uploads:

- Binary files arrive as `multipart/form-data`.
- `Content-Length` is checked before reading and the stream is capped while reading: 413 past the cap.
- The type comes from the bytes (magic numbers, archive layout); the client's `Content-Type` and extension are
  only hints. An unsupported type is 415.
- The uploaded filename is display text: sanitize it before showing it, and build paths only from IDs the
  server generated.
- Files are processed in memory and dropped, unless the feature stores files by design.

Downloads:

- A `GET` returns the file's bytes with its exact `Content-Type`.
- `Content-Disposition: attachment` carries an ASCII `filename` fallback plus `filename*=UTF-8''…`
  (RFC 6266, RFC 8187), built from a sanitized name.
- Tenant data is sent with `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.
- Spreadsheet cells pass through `sanitizeFormulaInjection` (`apps/web/lib/utils/file-conversion.ts`).

## Bound every input

- Every dimension of user input has a hardcoded cap: body and file size, decompressed size and archive
  entries, rows, cells, characters per field, array length, nesting depth, records created, AI calls,
  tokens and wall time, concurrent jobs per user and per process.
- Caps are generous: far above real use, yet low enough that no request can exhaust memory, CPU, the database
  or AI spend. A cap that looks too high is fine; a dimension with no cap is the defect.
- Caps are named constants in one module per feature, as in
  `apps/web/modules/survey/import/qsf/limits.ts`, reusing the shared ones that already apply (the v3 array
  budget in `apps/web/app/api/v3/lib/array-budget.ts`).
- Each cap is enforced at the earliest boundary, before parsing or inflating where possible, has a test at the
  boundary, and fails with an error that names the limit (413 for size, 422 otherwise).
- Database reads follow "Performance in Review" in `AGENTS.md`.
