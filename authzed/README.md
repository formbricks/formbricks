# Formbricks Authorization Schema (AuthZed / SpiceDB)

This directory contains the canonical SpiceDB schema for Formbricks and its
assertion-based validation suite.

- `schema.zed` — the canonical, non-composable authorization schema
  (`use typechecking`).
- `schema-validation.yaml` — relationships, assertions, and expected-relations
  blocks that pin down the schema's semantics.
- `validate.sh` — offline validation runner (local `zed` binary or the pinned
  `authzed/zed` container image; no SpiceDB server needed).

## Running the validation

```bash
pnpm authzed:validate
```

CI runs the same script on every pull request as part of `.github/workflows/pr.yml`.
The validation job is a dependency of the required `PR Check Summary`, so a
failing assertion blocks the change: it means the schema no longer matches the
documented semantics.

## Guiding principle: mirror the current system

The schema is a **technical migration of the current Formbricks authorization
system**. It models exactly what the application enforces today — no future
capabilities, no permission changes. A principal must never gain or lose access
because a check moved from application code into this schema.

Any schema change must keep `pnpm authzed:validate` green and extend the
assertions to document the new semantics. Intentional semantic changes require
updating the assertions in the same PR, with review.

## Mapping from the current system

| Application concept                                                  | Schema element                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Membership.role` (`owner`/`manager`/`member`/`billing`)             | `organization` relations `owner`/`manager`/`member`/`billing`                            |
| `TeamUser.role` (`admin`/`contributor`)                              | `team` relations `admin`/`contributor`                                                   |
| `WorkspaceTeam.permission` (`read`/`readWrite`/`manage`)             | `workspace` relations `reader_team`/`writer_team`/`manager_team` (subject `team#member`) |
| `ApiKeyWorkspace.permission` (`read`/`write`/`manage`)               | `workspace` relations `reader`/`writer`/`manager` (subject `api_key`)                    |
| `ApiKey.organizationAccess.accessControl` (`read`/`write`)           | `organization` relations `api_key_reader`/`api_key_writer`                               |
| `Survey.workspaceId` / `Dashboard.workspaceId` / `Response.surveyId` | `survey`/`dashboard` relation `workspace`; `response` relation `survey`                  |

Resource permissions preserve the operation-specific gates that exist today:

| Current application operation                                    | Schema permission                           | Required access                                         |
| ---------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Read organization teams and workspace-team assignments           | `organization.read_access`, `team.read`     | organization membership or `accessControl.read`/`write` |
| Rename teams or manage team membership                           | `organization.manage_access`, `team.manage` | team admin or `accessControl.write`                     |
| Delete a team                                                    | `team.delete`                               | owner/manager or `accessControl.write`                  |
| Read or edit a survey                                            | `survey.read`, `survey.write`               | workspace `read` or `readWrite`                         |
| Delete a survey through the web application or V3 API            | `survey.delete`                             | workspace `readWrite`                                   |
| Manage survey languages or delete through legacy management APIs | `survey.manage`                             | workspace `manage`                                      |
| Read or mutate a dashboard, including deletion                   | `dashboard.read`, `dashboard.write`         | workspace `read` or `readWrite`                         |
| Read/export a response                                           | `response.read`, `response.export`          | workspace `read`                                        |
| Update, tag, or delete a response through the web application    | `response.write`                            | workspace `readWrite`                                   |
| Delete a response through legacy management APIs                 | `response.manage`                           | workspace `manage`                                      |

Behavioral sources of truth in the application (referenced from the schema's
doc comments):

- `apps/web/lib/utils/action-client/action-client-middleware.ts` —
  `checkAuthorizationUpdated`: org-role OR team-permission, weighted
  `read < readWrite < manage`.
- `apps/web/lib/organization/auth.ts` — `verifyUserRoleAccess`: managers manage
  members/billing/API keys but cannot update or delete the organization.
- `apps/web/lib/workspace/auth.ts` — `hasUserWorkspaceAccessForAction`: the
  billing role is excluded from all product data.
- `apps/web/modules/ee/teams/lib/roles.ts` — a member without a team has no
  workspace access; the highest team permission wins.
- `apps/web/modules/organization/settings/api-keys/lib/utils.ts` — API key
  method map (GET→read, POST/PUT/PATCH→write, DELETE→manage) and
  organization `accessControl` checks.

## Semantics guaranteed by the assertions

1. **Owner and manager broad access** — org owners and managers have full
   access to every workspace and its content; only owners may update or delete
   the organization itself.
2. **Billing role blocked from product data** — billing reaches billing
   surfaces only; never workspaces, surveys, responses, or dashboards.
3. **Team-based workspace access** — teams are the only path from a plain
   member to a workspace; a member without a team has no product access.
4. **Externally scoped read-only access** — a read-level team confines an
   external (agency) user to viewing a single workspace. (Per-survey scoping
   does not exist today and is deliberately not modeled.)
5. **Dashboard read derives from workspace read** — dashboards carry no ACL of
   their own. Response export currently equals response read; the separate
   `response_export` permission keeps the vocabulary ready for a future split,
   which would be an asserted schema change.
6. **API key as scoped principal** — workspace-scoped keys act only inside
   their granted workspace at their granted level; organization-level
   `accessControl` rights grant access to organization access-control resources
   but no product data.

## Deliberately not modeled (stays in application code)

- Managers may only assign the `member` role when inviting/updating members.
- The billing role is rejected on self-hosted instances.
- `USER_MANAGEMENT_MINIMUM_ROLE` environment override.
- The coarse `hasUserWorkspaceAccess` layout check (billing routing concern).
- Organization-only API keys require per-route opt-in
  (`allowOrganizationOnlyApiKey`).
- Audit logs: writing is feature-flagged; there is no in-app read path, so no
  `read_audit_log` permission exists yet.
