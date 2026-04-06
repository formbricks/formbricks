# Plan: Deprecate Environments in Formbricks

**Issue**: https://github.com/formbricks/internal/issues/1501

## Context

Formbricks currently has a 4-level hierarchy: **Organization → Workspace → Environment (prod/dev) → Resources**. The "Environment" layer adds complexity with minimal value — the only real difference between prod and dev is separate API keys and a UI badge.

**Goal**: Collapse the Environment layer so resources live directly under Workspace. The production environment merges into the workspace identity. Dev environments with data become separate new workspaces.

**Key decisions**:
- DB model is `Workspace` (renamed from `Project` in PR #7620)
- SDK will accept `workspaceId` as new param, `environmentId` as deprecated alias
- Dev environments with data get promoted to separate workspaces

---

## Current State

```
Organization
  └── Workspace
        ├── Environment (production) ──→ surveys, contacts, webhooks, tags, ...
        └── Environment (development) ──→ surveys, contacts, webhooks, tags, ...
```

Every workspace always has exactly 2 environments. The only differences between them:
- Separate data (contacts, responses, attributes, integrations, webhooks, segments, etc.)
- Separate API keys (`ApiKeyEnvironment` grants per-environment permissions)
- A red warning banner in the dev UI, plus an environment switcher breadcrumb

Key metrics:
- **564 files** in `apps/web` reference `environmentId`
- **52 files** in `packages` reference `environmentId`
- **68+ route directories** under `/environments/[environmentId]/`
- **22 API endpoint directories** keyed by `[environmentId]`
- **9 resource tables** FK to Environment: `Survey`, `Contact`, `ActionClass`, `ContactAttributeKey`, `Webhook`, `Tag`, `Segment`, `Integration`, `ApiKeyEnvironment`
- **SDK** requires `environmentId` to initialize, all client APIs use `/api/v1/client/[environmentId]/...`
- **Storage** paths: `private/${environmentId}/${fileName}`

---

## Phase 1: Add `workspaceId` Column to All Environment-Owned Models ✅

> PR #7640 (merged) — superseded PR #7588 which used `projectId`

Added an **optional** `workspaceId` column alongside the existing `environmentId` on every model that currently only references Environment.

**Modified**: `packages/database/schema.prisma`
- Added `workspaceId String?` + FK to Workspace + index to: `Survey`, `Contact`, `ActionClass`, `ContactAttributeKey`, `Webhook`, `Tag`, `Segment`, `Integration`, `ApiKeyEnvironment`
- Added reverse relations on the `Workspace` model

---

## Phase 2: Backfill `workspaceId` ✅

> PR #7591 (merged)

Data migration to populate `workspaceId` on every existing row by joining through the Environment table: `Survey.environmentId → Environment.id → Environment.workspaceId`.

```sql
UPDATE "Survey" s SET "workspaceId" = e."projectId"
FROM "Environment" e WHERE s."environmentId" = e."id" AND s."workspaceId" IS NULL;
-- Repeat for all 9 tables
```

Idempotent — only updates rows where `workspaceId IS NULL`.

---

## Phase 3: Dual-Write ✅

> PR #7596 (merged)

All create/update operations write both `environmentId` AND `workspaceId`.

Pattern:
```typescript
import { getWorkspaceIdFromEnvironmentId } from "@/lib/utils/helper";

const workspaceId = await getWorkspaceIdFromEnvironmentId(environmentId);
await prisma.survey.create({ data: { environmentId, workspace: { connect: { id: workspaceId } }, ...rest } });
```

Two patterns used in source:
- `workspace: { connect: { id: workspaceId } }` — relational connect (most files)
- `workspaceId` — direct field assignment (segments.ts only)

---

## Phase 4: Make `workspaceId` NOT NULL ✅

> PR #7650 (open — in progress on branch `chore/deprecate-environments-make-workspace-id-not-null`)

Moved up from original Phase 10. Safe because Phases 1–3 guarantee every existing and new row has a valid `workspaceId`.

- Migration includes safety check that aborts if any NULL values remain
- Updated Prisma schema (`String?` → `String`, `Workspace?` → `Workspace`)
- Updated Zod schemas (`.nullable()` → `.cuid2()`)
- Fixed all 18 failing tests across 10 test files
- Fixed Playwright fixture (`users.ts`) to create `ContactAttributeKey` records with real `workspaceId` instead of placeholder string

---

## Phase 5: Switch Internal Reads to `workspaceId` 🔄

> PR #7605 (open)

Migrate all internal (non-API) read queries from `WHERE environmentId` to `WHERE workspaceId` across surveys, contacts, action classes, tags, webhooks, segments, integrations, and contact attribute keys.

- Page components resolve `workspaceId` from `environment.workspaceId` early and pass it downstream
- Service functions renamed: `getTagsByEnvironmentId` → `getTagsByWorkspaceId`, `getActionClassByEnvironmentIdAndName` → `getActionClassByWorkspaceIdAndName`, etc.
- 45 files changed

---

## Phase 6: Client API Backwards Compatibility 🔄

> PR #7609 (open)

Make `/api/v1/client/[environmentId]/...` and `/api/v2/client/[environmentId]/...` accept either an `environmentId` or a `workspaceId`.

- Added `resolveClientApiIds()` utility — tries Environment table first, falls back to Workspace table (production environment)
- Updated all v1/v2 client route handlers to use the resolver
- Existing SDK behaviour unchanged — old `environmentId` values continue to work

---

## Phase 7: Storage Path Migration 🔄

> PR #7649 (open)

New uploads store files under `{workspaceId}/{accessType}/{fileName}` instead of `{environmentId}/...`. Downloads and deletions try the workspaceId path first, falling back to the legacy environmentId path.

---

## Phase 8: Management API + API Key Migration (Upcoming)

The `ApiKeyEnvironment` model grants per-environment permissions. API keys used by integrations (Zapier, Make, etc.) reference environmentIds. These need to work at the workspace level.

- Modify `ApiKeyEnvironment` to support workspace-level permissions
- Update `apps/web/app/api/v1/auth.ts` — `authenticateRequest` resolves environment permissions to workspace
- Management route handlers accept `environmentId` OR `workspaceId` in request bodies
- API key management UI in `modules/organization/settings/api-keys/`

---

## Phase 9: Dev Environment Data Migration (Shaping)

Promote dev environments with data into separate standalone workspaces so that data isn't lost when the environment layer is removed.

### Strategy

For each Workspace with a development Environment **that has data**:
1. Create new Workspace named `{name} (Dev)` in the same Organization
2. Create a production Environment for the new Workspace
3. Re-parent all dev environment resources to the new Workspace (update `workspaceId`)
4. Re-parent resources to the new production environment (update `environmentId`)

For development environments with **no data**: leave as-is (cleaned up in Phase 11).

### Prerequisites
- Phase 4 (NOT NULL) must be merged so the migration can set `workspaceId` on re-parented rows
- Playwright test fixtures must work with the NOT NULL constraint (fixed in Phase 4)

### Key considerations
- **Data detection**: Define "has data" — environments with at least one survey, contact, response, or webhook
- **API key migration**: `ApiKeyEnvironment` entries pointing to dev environments need to be updated to point to the new workspace's production environment
- **Storage files**: Files at `{environmentId}/...` paths need to remain accessible (handled by Phase 7 fallback)
- **Idempotent**: Migration script must be safe to re-run (skip workspaces already migrated)

### Files to create/modify
- `packages/database/migration/` — idempotent migration script
- Test fixtures that create dev environments may need updating

---

## Phase 10: New `/workspaces/[workspaceId]/` Routes + Redirects (Upcoming — Very Large, High Risk)

Create the new route group mirroring the old structure, remove the environment switcher breadcrumb, and add redirects so old bookmarked URLs still work.

- Create `/apps/web/app/(app)/workspaces/[workspaceId]/` route group mirroring the environments structure
- New layout resolves `workspaceId` directly
- Old `/environments/[environmentId]/...` routes redirect to `/workspaces/{workspaceId}/...`
- Update `apps/web/app/page.tsx` to redirect to workspace URLs
- Remove environment switcher breadcrumb

**Can be split** into sub-PRs: layout first, then surveys, then settings, etc.

---

## Phase 11: JS SDK Update (Upcoming — Medium, Low Risk)

Add `workspaceId` as the new init parameter. `environmentId` keeps working as a deprecated alias.

- `packages/js-core/src/types/config.ts` — add `workspaceId` to `TConfigInput`
- `packages/js-core/src/lib/common/setup.ts` — accept `workspaceId`, fall back to `environmentId`

```typescript
// New:
formbricks.init({ workspaceId: "cxxx", appUrl: "..." })
// Old (still works):
formbricks.init({ environmentId: "cxxx", appUrl: "..." })
```

---

## Verification

After each PR:
1. `pnpm build` passes
2. Existing tests pass (`pnpm test`)
3. Manual smoke test: create survey, submit response, check dashboard
4. SDK initialization works with existing `environmentId`

After full migration:
- Old environment URLs redirect correctly
- Old API keys work
- Old SDK `environmentId` init works
- New `workspaceId` SDK init works
- Storage files accessible via both old and new paths
- Dev environments with data are separate workspaces

---

## PR Summary

| Phase | Description | Status | PR |
|-------|-------------|--------|-----|
| 1 | Add nullable `workspaceId` columns | ✅ Merged | #7640 |
| 2 | Backfill `workspaceId` data migration | ✅ Merged | #7591 |
| 3 | Dual-write `workspaceId` on all creates | ✅ Merged | #7596 |
| 4 | Make `workspaceId` NOT NULL | 🔄 Open | #7650 |
| 5 | Switch internal reads to `workspaceId` | 🔄 Open | #7605 |
| 6 | Client API backwards compat | 🔄 Open | #7609 |
| 7 | Storage path migration | 🔄 Open | #7649 |
| 8 | Management API + API key migration | Upcoming | — |
| 9 | Dev environment → workspace promotion | Shaping | — |
| 10 | New workspace routes + redirects | Upcoming | — |
| 11 | JS SDK `workspaceId` support | Upcoming | — |
