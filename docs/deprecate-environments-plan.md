# Plan: Deprecate Environments in Formbricks

**Issue**: https://github.com/formbricks/internal/issues/1501

## Context

Formbricks currently has a 4-level hierarchy: **Organization → Project → Environment (prod/dev) → Resources**. The "Environment" layer adds complexity with minimal value — the only real difference between prod and dev is separate API keys and a UI badge. The UI already calls "Project" a "Workspace".

**Goal**: Collapse the Environment layer so resources live directly under Project. The production environment merges into the workspace identity. Dev environments with data become separate new workspaces.

**Key decisions**:
- DB model stays as `Project` (no table rename)
- SDK will accept `workspaceId` as new param, `environmentId` as deprecated alias
- Dev environments with data get promoted to separate workspaces

---

## Current State

```
Organization → Project → Environment (prod/dev) → [Survey, Contact, ActionClass, Tag, Segment, Webhook, Integration, ContactAttributeKey]
```

- **564 files** in `apps/web` reference `environmentId`
- **52 files** in `packages` reference `environmentId`
- **16+ helper functions** in `apps/web/lib/utils/helper.ts` traverse Environment → Project → Org
- **URL pattern**: `/environments/[environmentId]/...`
- **SDK**: requires `environmentId` for init, all client APIs use `/api/v1/client/[environmentId]/...`
- **API keys**: `ApiKeyEnvironment` grants per-environment permissions
- **Storage**: files at `private/${environmentId}/${fileName}`

---

## Phase 1: Environment Resolution Abstraction (PR 1 — Small, Low Risk)

Create a single indirection point so all environment lookups can later be swapped transparently.

**Create**: `apps/web/lib/environment/resolver.ts`
- `resolveToProjectId(environmentIdOrProjectId: string): Promise<string>` — tries Environment table first, falls back to Project table
- `resolveEnvironmentToProject(environmentId: string): Promise<{ projectId: string; environmentId: string }>`

**Modify**: `apps/web/lib/utils/helper.ts`
- Update all 16+ helper functions to use the resolver instead of direct `getEnvironment()` calls

---

## Phase 2: Add `projectId` Column to All Environment-Owned Models (PR 2 — Small, Low Risk)

Add an **optional** `projectId` column alongside the existing `environmentId` on every model that currently only references Environment.

**Modify**: `packages/database/schema.prisma`
- Add `projectId String?` + FK + index to: `Survey`, `Contact`, `ActionClass`, `ContactAttributeKey`, `Webhook`, `Tag`, `Segment`, `Integration`
- New Prisma migration file

No code changes. No runtime behavior change. All new columns are NULL.

---

## Phase 3: Backfill `projectId` (PR 3 — Small, Medium Risk)

Data migration to populate `projectId` on every existing row.

```sql
UPDATE "Survey" s SET "projectId" = e."projectId"
FROM "Environment" e WHERE s."environmentId" = e."id" AND s."projectId" IS NULL;
-- Repeat for all 8 tables
```

**Create**: Migration script (batched for large DBs)

App behavior unchanged. New columns now populated but not yet read.

---

## Phase 4: Dual-Write (PR 4 — Large, Medium Risk)

All create/update operations write both `environmentId` AND `projectId`.

**Key files to modify**:
- `apps/web/lib/survey/service.ts` — `createSurvey`, `updateSurvey`
- `apps/web/lib/environment/service.ts` — `createEnvironment`
- `apps/web/modules/projects/settings/lib/project.ts` — `createProject`
- `apps/web/modules/survey/list/lib/survey.ts` — `copySurveyToOtherEnvironment`
- All ActionClass, Contact, Webhook, Tag, Segment, Integration creation functions
- All management API routes that create resources

Pattern:
```typescript
const projectId = await resolveToProjectId(environmentId);
await prisma.survey.create({ data: { environmentId, projectId, ...rest } });
```

---

## Phase 5: Switch Internal Reads to `projectId` (PR 5 — Very Large, High Risk)

Change internal (non-API) queries from `WHERE environmentId = ?` to `WHERE projectId = ?`.

**Key files**:
- `apps/web/modules/survey/list/lib/survey.ts` — `getSurveys(environmentId)` → `getSurveys(projectId)`
- `apps/web/app/api/v1/client/[environmentId]/environment/lib/data.ts` — `getEnvironmentStateData`
- `apps/web/modules/environments/lib/utils.ts` — `getEnvironmentAuth`, `getEnvironmentLayoutData`
- `apps/web/app/(app)/environments/[environmentId]/layout.tsx` — resolve `projectId` early, pass to context
- `apps/web/app/(app)/environments/[environmentId]/context/environment-context.tsx` — add `projectId`
- All page server components that pass `environmentId` to service functions

URL still has `[environmentId]`. Each page resolves `environmentId → projectId` at the top.

**This PR can be split further** by migrating one resource type at a time (surveys first, then contacts, then actions, etc.).

---

## Phase 6: Client API Backwards Compatibility (PR 6 — Medium, Medium Risk)

Make `/api/v1/client/[environmentId]/...` and `/api/v2/client/[environmentId]/...` accept either an `environmentId` or a `projectId`.

**Add resolver at top of each route handler**:
```typescript
const projectId = await resolveToProjectId(params.environmentId);
```

**Files**:
- `apps/web/app/api/v1/client/[environmentId]/environment/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/displays/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/responses/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/storage/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/user/route.ts`
- `apps/web/app/api/v2/client/[environmentId]/` — all routes

**Cache keys**: Normalize to `projectId` as canonical key in `packages/cache/src/cache-keys.ts`.

---

## Phase 7: Management API + API Key Migration (PR 7 — Medium, Medium Risk)

- Modify `ApiKeyEnvironment` to also support project-level permissions (or add `projectId` to the model)
- Update `apps/web/app/api/v1/auth.ts` — `authenticateRequest` resolves environment permissions to project
- Management route handlers accept `environmentId` OR `projectId` in request bodies
- API key management UI in `modules/organization/settings/api-keys/`

---

## Phase 8: Storage Path Migration (PR 8 — Medium, Medium Risk)

- New uploads use `{projectId}/{accessType}/{fileName}`
- Downloads check both `{projectId}/...` and `{environmentId}/...` paths for backwards compat
- `apps/web/modules/storage/service.ts`
- `apps/web/app/storage/[environmentId]/[accessType]/[fileName]/route.ts`

---

## Phase 9: Dev Environment Data Migration (PR 9 — Large, High Risk)

For each Project with a development Environment that has data:
1. Create new Project named `{name} (Dev)` in the same Organization
2. Create a production Environment for the new Project
3. Re-parent all dev environment resources to the new Project (update `projectId`)
4. Re-parent resources to the new production environment (update `environmentId`)

For development environments with NO data: leave as-is (will be cleaned up later).

**Create**: Idempotent migration script in `packages/database/migration/` or `scripts/`

---

## Phase 10: New `/workspaces/[projectId]/` Routes + Redirects (PR 10 — Very Large, High Risk)

- Create `/apps/web/app/(app)/workspaces/[projectId]/` route group mirroring the environments structure
- New layout resolves `projectId` directly
- Old `/environments/[environmentId]/...` routes redirect to `/workspaces/{projectId}/...`
- Update `apps/web/app/page.tsx` to redirect to workspace URLs
- Remove environment switcher breadcrumb

**Can be split** into sub-PRs: layout first, then surveys, then settings, etc.

---

## Phase 11: Make `projectId` NOT NULL (PR 11 — Small, Low Risk)

```sql
ALTER TABLE "Survey" ALTER COLUMN "projectId" SET NOT NULL;
-- Repeat for all 8 tables
```

Pre-check: verify no NULL values remain.

---

## Phase 12: JS SDK Update (PR 12 — Medium, Low Risk)

- `packages/js-core/src/types/config.ts` — add `workspaceId` to `TConfigInput`
- `packages/js-core/src/lib/common/setup.ts` — accept `workspaceId`, fall back to `environmentId`
- `environmentId` continues working as deprecated alias indefinitely

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

| PR | Phase | Description | Size | Risk |
|----|-------|-------------|------|------|
| 1 | 1 | Environment resolution abstraction | S | Low |
| 2 | 2 | Add nullable `projectId` columns | S | Low |
| 3 | 3 | Backfill `projectId` data migration | S | Med |
| 4 | 4 | Dual-write `projectId` on all creates | L | Med |
| 5 | 5 | Switch reads to `projectId` | XL | High |
| 6 | 6 | Client API backwards compat | M | Med |
| 7 | 7 | Management API + API key migration | M | Med |
| 8 | 8 | Storage path migration | M | Med |
| 9 | 9 | Dev environment → workspace promotion | L | High |
| 10 | 10 | New workspace routes + redirects | XL | High |
| 11 | 11 | Make `projectId` NOT NULL | S | Low |
| 12 | 12 | JS SDK `workspaceId` support | M | Low |
