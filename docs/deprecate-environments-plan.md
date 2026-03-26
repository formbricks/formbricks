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
Organization
  └── Project ("Workspace" in UI)
        ├── Environment (production) ──→ surveys, contacts, webhooks, tags, ...
        └── Environment (development) ──→ surveys, contacts, webhooks, tags, ...
```

Every project always has exactly 2 environments. The only differences between them:
- Separate data (contacts, responses, attributes, integrations, webhooks, segments, etc.)
- Separate API keys (`ApiKeyEnvironment` grants per-environment permissions)
- A red warning banner in the dev UI, plus an environment switcher breadcrumb

Key metrics:
- **564 files** in `apps/web` reference `environmentId`
- **52 files** in `packages` reference `environmentId`
- **68+ route directories** under `/environments/[environmentId]/`
- **22 API endpoint directories** keyed by `[environmentId]`
- **8 resource tables** FK to Environment: `Survey`, `Contact`, `ActionClass`, `ContactAttributeKey`, `Webhook`, `Tag`, `Segment`, `Integration`
- **SDK** requires `environmentId` to initialize, all client APIs use `/api/v1/client/[environmentId]/...`
- **Storage** paths: `private/${environmentId}/${fileName}`

---

## Phase 1: Add `projectId` Column to All Environment-Owned Models (PR 1 — Small, Low Risk)

Add an **optional** `projectId` column alongside the existing `environmentId` on every model that currently only references Environment.

**Why**: Today, Survey has `environmentId` pointing to Environment, and you have to join through Environment to reach Project. We need Survey to point directly to Project. But we can't just switch the FK in one shot — that would break everything. So we add a new nullable `projectId` column alongside the existing `environmentId`. No code changes, no runtime impact. Just schema preparation.

**Modify**: `packages/database/schema.prisma`
- Add `projectId String?` + FK to Project + index to: `Survey`, `Contact`, `ActionClass`, `ContactAttributeKey`, `Webhook`, `Tag`, `Segment`, `Integration`
- Add reverse relations on the `Project` model
- New Prisma migration file

No code changes. No runtime behavior change. All new columns are NULL.

---

## Phase 2: Backfill `projectId` (PR 2 — Small, Medium Risk)

Data migration to populate `projectId` on every existing row.

**Why**: The new `projectId` columns are all NULL. We need to populate them by joining through the Environment table: `Survey.environmentId → Environment.id → Environment.projectId`. After this, every row has both `environmentId` (old) and `projectId` (new) filled in, but the app still only reads `environmentId`.

```sql
UPDATE "Survey" s SET "projectId" = e."projectId"
FROM "Environment" e WHERE s."environmentId" = e."id" AND s."projectId" IS NULL;
-- Repeat for all 8 tables
```

**Create**: Migration script (idempotent — only updates rows where `projectId IS NULL`)

App behavior unchanged. New columns now populated but not yet read.

---

## Phase 3: Dual-Write (PR 3 — Large, Medium Risk)

All create/update operations write both `environmentId` AND `projectId`.

**Why**: New rows created after the backfill would still have `projectId = NULL` because the app code doesn't know about the new column yet. We update every `prisma.survey.create(...)`, `prisma.contact.create(...)`, etc. to write both `environmentId` and `projectId`. Now every new row gets both values. Old code still reads `environmentId` — nothing breaks.

**Key files to modify**:
- `apps/web/lib/survey/service.ts` — `createSurvey`
- `apps/web/lib/environment/service.ts` — `createEnvironment` (creates default ContactAttributeKeys)
- `apps/web/modules/projects/settings/lib/project.ts` — `createProject`
- `apps/web/modules/survey/list/lib/survey.ts` — `copySurveyToOtherEnvironment`
- `apps/web/modules/survey/components/template-list/lib/survey.ts` — `createSurvey`
- `apps/web/lib/actionClass/service.ts` — `createActionClass`
- `apps/web/modules/survey/editor/lib/action-class.ts` — `createActionClass`
- `apps/web/modules/ee/contacts/lib/contacts.ts` — `processCsvRecord`, `createMissingAttributeKeys`
- `apps/web/modules/ee/contacts/api/v2/management/contacts/lib/contact.ts` — `createContact`
- `apps/web/app/api/v1/client/[environmentId]/displays/lib/display.ts` — `createDisplay` (creates contacts)
- `apps/web/modules/ee/contacts/lib/contact-attribute-keys.ts` — `createContactAttributeKey`
- `apps/web/modules/api/v2/management/contact-attribute-keys/lib/contact-attribute-key.ts` — `createContactAttributeKey`
- `apps/web/modules/ee/contacts/api/v1/management/contact-attribute-keys/lib/contact-attribute-keys.ts` — `createContactAttributeKey`
- `apps/web/modules/integrations/webhooks/lib/webhook.ts` — `createWebhook`
- `apps/web/modules/api/v2/management/webhooks/lib/webhook.ts` — `createWebhook`
- `apps/web/app/api/v1/webhooks/lib/webhook.ts` — `createWebhook`
- `apps/web/lib/tag/service.ts` — `createTag`
- `apps/web/modules/ee/contacts/segments/lib/segments.ts` — `createSegment`, `cloneSegment`, `resetSegmentInSurvey`
- `apps/web/lib/integration/service.ts` — `createOrUpdateIntegration`

Pattern:
```typescript
// Resolve environmentId to projectId using existing getEnvironment()
const environment = await getEnvironment(environmentId);
const projectId = environment.projectId;
await prisma.survey.create({ data: { environmentId, projectId, ...rest } });
```

---

## Phase 4: Switch Internal Reads to `projectId` (PR 4 — Very Large, High Risk)

Change internal (non-API) queries from `WHERE environmentId = ?` to `WHERE projectId = ?`.

**Why**: This is the actual migration. Every query that says `WHERE environmentId = X` changes to `WHERE projectId = X`. Functions like `getSurveys(environmentId)` become `getSurveys(projectId)`. The layout at `/environments/[environmentId]/layout.tsx` resolves the environmentId from the URL to a projectId early on and passes projectId downstream. After this phase, the app internally thinks in terms of projects, not environments, even though URLs still say `[environmentId]`.

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

## Phase 5: Client API Backwards Compatibility (PR 5 — Medium, Medium Risk)

Make `/api/v1/client/[environmentId]/...` and `/api/v2/client/[environmentId]/...` accept either an `environmentId` or a `projectId`.

**Why**: The SDK sends requests to `/api/v1/client/[environmentId]/...`. Existing deployed SDKs will keep sending environmentIds. New SDKs will send projectIds. Each route handler needs to accept either and resolve to a projectId internally. This ensures old SDK versions don't break.

**Add fallback resolution at top of each route handler**:
```typescript
// Try Environment table first, fall back to Project table
let projectId: string;
const environment = await prisma.environment.findUnique({ where: { id: params.environmentId } });
if (environment) {
  projectId = environment.projectId;
} else {
  projectId = params.environmentId; // caller passed a projectId directly
}
```

**Files**:
- `apps/web/app/api/v1/client/[environmentId]/environment/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/displays/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/responses/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/storage/route.ts`
- `apps/web/app/api/v1/client/[environmentId]/user/route.ts`
- `apps/web/app/api/v2/client/[environmentId]/` — all routes

---

## Phase 6: Management API + API Key Migration (PR 6 — Medium, Medium Risk)

**Why**: The `ApiKeyEnvironment` model grants per-environment permissions. API keys used by integrations (Zapier, Make, etc.) reference environmentIds. These need to work at the project level. The management API endpoints that accept `environmentId` in request bodies need to also accept `projectId`.

- Modify `ApiKeyEnvironment` to also support project-level permissions (or add `projectId` to the model)
- Update `apps/web/app/api/v1/auth.ts` — `authenticateRequest` resolves environment permissions to project
- Management route handlers accept `environmentId` OR `projectId` in request bodies
- API key management UI in `modules/organization/settings/api-keys/`

---

## Phase 7: Storage Path Migration (PR 7 — Medium, Medium Risk)

**Why**: Uploaded files are stored at paths like `private/{environmentId}/{fileName}`. New uploads should use `{projectId}/...`, but old files still live at the old paths. Downloads need to check both locations for backward compatibility.

- New uploads use `{projectId}/{accessType}/{fileName}`
- Downloads check both `{projectId}/...` and `{environmentId}/...` paths for backwards compat
- `apps/web/modules/storage/service.ts`
- `apps/web/app/storage/[environmentId]/[accessType]/[fileName]/route.ts`

---

## Phase 8: Dev Environment Data Migration (PR 8 — Large, High Risk)

**Why**: Currently each project has a prod and dev environment. After the migration, there's no "environment" concept — just projects. Dev environments with no data can be discarded. Dev environments with data need to be promoted into new standalone projects so that data isn't lost.

For each Project with a development Environment that has data:
1. Create new Project named `{name} (Dev)` in the same Organization
2. Create a production Environment for the new Project
3. Re-parent all dev environment resources to the new Project (update `projectId`)
4. Re-parent resources to the new production environment (update `environmentId`)

For development environments with NO data: leave as-is (will be cleaned up later).

**Create**: Idempotent migration script in `packages/database/migration/` or `scripts/`

---

## Phase 9: New `/workspaces/[projectId]/` Routes + Redirects (PR 9 — Very Large, High Risk)

**Why**: The URL currently says `/environments/[environmentId]/surveys/...`. After the migration, it should say `/workspaces/[projectId]/surveys/...`. This phase creates the new route group mirroring the old structure, removes the environment switcher breadcrumb, and adds redirects so old bookmarked URLs still work.

- Create `/apps/web/app/(app)/workspaces/[projectId]/` route group mirroring the environments structure
- New layout resolves `projectId` directly
- Old `/environments/[environmentId]/...` routes redirect to `/workspaces/{projectId}/...`
- Update `apps/web/app/page.tsx` to redirect to workspace URLs
- Remove environment switcher breadcrumb

**Can be split** into sub-PRs: layout first, then surveys, then settings, etc.

---

## Phase 10: Make `projectId` NOT NULL (PR 10 — Small, Low Risk)

**Why**: At this point, every row has `projectId` populated (backfill + dual-write), and all reads use `projectId`. Now we can safely make it required in the schema. This is a safety net — the DB will reject any row that somehow doesn't have a projectId.

```sql
ALTER TABLE "Survey" ALTER COLUMN "projectId" SET NOT NULL;
-- Repeat for all 8 tables
```

Pre-check: verify no NULL values remain.

---

## Phase 11: JS SDK Update (PR 11 — Medium, Low Risk)

**Why**: Add `workspaceId` as the new init parameter. `environmentId` keeps working as a deprecated alias. Existing integrations don't break.

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
| 1 | 1 | Add nullable `projectId` columns | S | Low |
| 2 | 2 | Backfill `projectId` data migration | S | Med |
| 3 | 3 | Dual-write `projectId` on all creates | L | Med |
| 4 | 4 | Switch reads to `projectId` | XL | High |
| 5 | 5 | Client API backwards compat | M | Med |
| 6 | 6 | Management API + API key migration | M | Med |
| 7 | 7 | Storage path migration | M | Med |
| 8 | 8 | Dev environment → workspace promotion | L | High |
| 9 | 9 | New workspace routes + redirects | XL | High |
| 10 | 10 | Make `projectId` NOT NULL | S | Low |
| 11 | 11 | JS SDK `workspaceId` support | M | Low |
