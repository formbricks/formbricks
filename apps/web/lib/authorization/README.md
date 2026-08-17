# Current Authorization Contract

This server-only module defines the engine-independent actor, action, and
resource vocabulary enforced by Formbricks today. Product authorization code
depends on this contract; AuthZed/SpiceDB is one possible evaluator of it.

The contract deliberately contains no AuthZed SDK types, configuration,
relationship writes, or network behavior. Resource IDs are opaque strings.
Existence, tenant boundaries, and permission evaluation remain runtime
responsibilities.

## Public contract

Import the types from `@/lib/authorization`. Actions are namespaced by the
application resource discriminant, for example `workspace.read` and
`survey.response_export`. The `apiKey` discriminant matches the existing
Formbricks authentication type; the downstream SpiceDB schema maps it to its
`api_key` definition.

`TAuthorizationResourceForAction<TAction>` preserves the action/resource
relationship for the central authorization API. The action must be the sole
generic inference source:

```ts
const can = async <TAction extends TAuthorizationAction>(
  actor: TAuthorizationActor,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>
): Promise<boolean> => {
  // Implemented by ENG-1712.
};
```

Using `NoInfer` on the resource argument prevents TypeScript from widening an
invalid action/resource pair into a union.

## Current role and grant mapping

Organization membership establishes organization capabilities:

| Current source              | Current behavior                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Membership.role = owner`   | Reads, updates, and deletes the organization; has broad product, billing, access-control, and API-key management access. |
| `Membership.role = manager` | Has broad product, billing, access-control, and API-key management access, but cannot update or delete the organization. |
| `Membership.role = member`  | Can see the organization and access-control resources; receives product access only through team membership.             |
| `Membership.role = billing` | Can see the organization and billing surfaces but receives no product-data access.                                       |

Team and workspace grants use ordered permission ladders:

| Current source                                  | Permission implication                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `TeamUser.role = contributor`                   | Team membership and team read.                                                                              |
| `TeamUser.role = admin`                         | Contributor capabilities plus team management. Team deletion still requires organization access management. |
| `WorkspaceTeam.permission = read`               | `workspace.read`.                                                                                           |
| `WorkspaceTeam.permission = readWrite`          | `workspace.read` and `workspace.write`.                                                                     |
| `WorkspaceTeam.permission = manage`             | `workspace.read`, `workspace.write`, `workspace.manage`, and `workspace.share`.                             |
| `ApiKeyWorkspace.permission = read`             | `workspace.read`.                                                                                           |
| `ApiKeyWorkspace.permission = write`            | `workspace.read` and `workspace.write`.                                                                     |
| `ApiKeyWorkspace.permission = manage`           | `workspace.read`, `workspace.write`, `workspace.manage`, and `workspace.share`.                             |
| `ApiKey.organizationAccess.accessControl.read`  | Organization access-control and team read access.                                                           |
| `ApiKey.organizationAccess.accessControl.write` | Read access plus organization access management and team management/deletion.                               |

Surveys, dashboards, and responses inherit access through their workspace:

- Survey read/write/publish follow workspace read/write.
- Survey deletion in the web application and V3 API currently requires
  workspace write; legacy management deletion and language management require
  workspace manage.
- Dashboard read/write follow workspace read/write, including dashboard
  deletion.
- Response read and export currently both follow workspace read. They remain
  separate actions so a future policy split is explicit.
- Response updates, tags, and web-application deletion follow workspace write;
  legacy management deletion follows workspace manage.

Feedback Datasets use `FeedbackDirectory` as their application resource. Organization owners and
managers administer every dataset in their organization. Team members and API keys receive dataset
read/write/manage through `FeedbackDirectoryWorkspace` and their existing permission on that exact
workspace. The `feedbackDirectoryAssignment` resource therefore requires both the directory ID and a
`workspaceId`; directory-wide gateway operations use the aggregate `feedbackDirectory` resource.

The downstream SpiceDB schema names these definitions `feedback_directory` and
`feedback_directory_assignment`. Product code must continue using the camel-case application names and
must not depend on that downstream naming convention.

## Configuration-sensitive policy

`organization.manage_access` is a stable application capability, but the legacy
evaluator must continue honoring `USER_MANAGEMENT_MINIMUM_ROLE`:

- `manager`: owners and managers may manage users.
- `owner`: only owners may manage users.
- `disabled`: no organization role may manage users through that policy.

This deployment setting is evaluator input. It is not encoded into the static
actor/action/resource types.

## Migration inventory

The central interface uses the legacy evaluator unless an internal ENG-1738
rollout rule selects the current request surface and organization. Migration
means callers use semantic actor/action/resource decisions; deployments with
authorization rollout disabled have no AuthZed read dependency.

### Added by ENG-1738

- A private SpiceDB evaluator behind the unchanged `can()` and `assertCan()`
  interface.
- PostgreSQL actor/resource existence and tenant-boundary resolution before a
  SpiceDB check.
- Post-response shadow comparison for selected authenticated request surfaces.
- Per-surface and per-organization enforcement cohorts with fail-closed
  operational behavior.
- Bounded, identifier-free comparison metrics and mismatch/error logs.

Surveys, dashboards, and responses are intentionally resolved to their owning
workspace before the SpiceDB check. Their parent relationships are not yet
projected, so checking those resource definitions directly would turn every
valid legacy decision into a false denial. This remains a current-model
migration; resource-level relationships belong to the later sharing phase.

### Migrated by ENG-1714

- Canonical organization, workspace-team, and team-admin patterns accepted by
  the action-client compatibility adapter.
- Organization membership and role helper decisions.
- Action-aware workspace access and shared analysis/V3 session workspace
  authorization.
- Organization settings, workspace settings, team operations, and
  user-managed API-key settings migrated to explicit actions.

### Migrated by ENG-1731

- API-key principals in V1, V2, V3, MCP, and storage authorization paths.
- `ApiKeyWorkspace` permissions and organization access-control flags.
- Organization-only API-key opt-in and API-key revocation behavior.

### Migrated by ENG-1737

- The broad, non-action-aware `hasUserWorkspaceAccess` helper is gone.
  `getWorkspaceAuth` asks for `workspace.read`; the four navigation callers ask
  `canUserNavigateWorkspace`, which is `workspace.read` or
  `organization.manage_billing` — the second disjunct exists only because
  reaching a workspace URL is how the `billing` role gets to billing.
- The action-client adapter's parallel legacy evaluator is gone. Every access
  shape the repository produces maps onto exactly one central action, so the
  fallback could only repeat a decision already made. Its `team` shape was
  removed with it, an unmapped organization role set is now refused and logged
  as a caller bug, and an empty requirement list is refused rather than passing.
- The two remaining role-name gates outside the module: workspace creation
  during onboarding, and the self-hosted license recheck. The latter denied the
  `member` role by name, which admitted `billing`; `organization.manage` is what
  its own message always claimed.

#### Retained by design

These read a role but do not decide access, so they stay as they are:

- **Rendering.** Navigation, sidebars, settings forms, and role pickers take
  `getAccessFlags` output as props. Hiding a control is not a gate; the gate is
  on the action or page behind it.
- **Context output.** `getWorkspaceAuth` and `getOrganizationAuth` _return_ the
  flags for those consumers. Their own gates are `can` calls.
- **Invariants and finer rules.** An owner may not leave their organization; a
  manager may only assign the `member` role; `billing` is Cloud-only. The
  schema comments already name these as application rules — they constrain a
  request's _content_, not the principal's capability.
- **Invite fan-out.** The signup and invite paths derive from the _invited_
  role whether to create `TeamUser` rows, since owners and managers get
  workspace access from the role itself. That is a statement about the invite.
- **List scoping.** Workspace list queries remain PostgreSQL-authoritative and narrow by role instead
  of asking a question per row. MCP `list_workspaces` is the one narrow Phase 1 exception: it queues a
  single shadow-only `LookupResources(workspace, read)` comparison after the response and counts that
  list observation as one central authorization operation. It never changes the returned list and does
  not expose generic lookup or enforcement semantics; those remain ENG-1713.

New authorization-sensitive code must use `can` or `assertCan`; it must not add
callers to the deprecated action-client adapter or reintroduce a role-name gate.

## Resource coverage inventory

`resource-inventory.ts` classifies every Prisma model and audit target exactly once. Its regression test
fails when a new model or target has not been reviewed. The inventory distinguishes direct authorization
resources, relationship/grant sources, workspace-inherited resources, parent-derived integrity data,
authentication/application concerns, and explicit public/out-of-scope data.

Charts and workflows remain workspace-inherited. Feedback records remain protected by their
dataset/workspace authorization decision plus application-level tenant and integrity validation.

## Explicit exclusions

The current contract has no system/service principal, survey-level sharing,
per-dashboard ACL, audit-log permission, contextual data-policy capability, or
generic enforcement-authoritative list-resource lookup. Those require later product decisions and must
not be added as part of the current-model migration.
