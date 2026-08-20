# Current Authorization Contract

This server-only module defines the engine-independent actor, action, and
resource vocabulary enforced by Formbricks today. Product authorization code
depends on this contract; AuthZed/SpiceDB is the sole runtime evaluator of it.

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

`organization.manage_access` is a stable application capability, and the SpiceDB
evaluator continues honoring `USER_MANAGEMENT_MINIMUM_ROLE` when selecting the
permission checked for user actors:

- `manager`: owners and managers may manage users.
- `owner`: only owners may manage users.
- `disabled`: no organization role may manage users through that policy.

This deployment setting is evaluator input. It is not encoded into the static
actor/action/resource types.

## Migration inventory and authority contract

The pinned bridge artifact uses the legacy evaluator only while its durable
relationship graph is established. The direct-authority candidate sends every
central decision to SpiceDB, including calls outside a request surface, and
contains no runtime selector or legacy fallback. A disabled or unhealthy
AuthZed client is an operational failure rather than permission denial or a
signal to select the bridge evaluator.

The immutable bridge and candidate artifacts, fail-closed semantics,
sandbox-first validation, environment gates, and deployment-only rollback are
defined in [`authzed/CUTOVER.md`](../../../../authzed/CUTOVER.md).

### Historical bridge capabilities added by ENG-1738

- A private SpiceDB evaluator behind the unchanged `can()` and `assertCan()`
  interface.
- PostgreSQL actor/resource existence and tenant-boundary resolution before a
  SpiceDB check.
- Post-response comparison for selected authenticated request surfaces.
- Per-surface and per-organization migration cohorts.
- Bounded, identifier-free comparison metrics and mismatch/error logs.

These capabilities supported parity research. They are removed before direct
authority and are not a sandbox, staging, production, or self-hosted rollout
mechanism.

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

### Migrated by ENG-2388 and ENG-2409

ENG-2388 added the `page` surface for server-rendered routes. Until then a `can`
call from a page or layout resolved no rollout target, so the coordinator
short-circuited to the legacy evaluator and scheduled no comparison — those
decisions were correct and invisible at the same time. The surface is opened at
the choke points routes already funnel through (`getWorkspaceAuth`,
`workspaceIdLayoutChecks`, `getWorkspaceLayoutData`) rather than at one boundary,
because Next gives no RSC equivalent of the action-client wrapper.

ENG-2409 then routed the organization-side gates, which a surface alone could not
help because they never called `can` at all:

| Gate                                                     | Was                               | Now                            |
| -------------------------------------------------------- | --------------------------------- | ------------------------------ |
| `getOrganizationAuth` tenancy check                      | `if (!membership) throw`          | `organization.read`            |
| `redirectBillingRoleFromRestrictedOrgSettings` (5 pages) | `isBilling`                       | `organization.read_access`     |
| Enterprise settings page                                 | `isMember`                        | `organization.manage_billing`  |
| Feedback directories page                                | `isOwner \|\| isManager`          | `organization.manage`          |
| API keys page                                            | `role === "owner" \|\| "manager"` | `organization.manage_api_keys` |

Two of those deserve their reasoning recorded, because the obvious mapping is
wrong in both cases:

- **`read_access`, not `read`,** for the billing redirect. `read_access` is the
  only permission whose expansion is "holds a product-eligible membership role",
  which is what "not the billing role" means here. `product_member` has the same
  expansion but is deliberately absent from the permission map — it exists to
  intersect into `team#member`, and giving it a second job would mean a future
  edit to it silently changed team-derived workspace access.
- **`manage_billing`, not `manage`,** for the enterprise page. On self-hosted,
  `getOrganizationBillingPath` resolves to that very page, so it is where the
  `billing` role is redirected _to_. Gating it on owner+manager would 404 that
  role on its own landing page.

#### Retained by design

These read a role but do not decide access, so they stay as they are:

- **Rendering.** Navigation, sidebars, settings forms, and role pickers take
  `getAccessFlags` output as props. Hiding a control is not a gate; the gate is
  on the action or page behind it.
- **Context output.** `getWorkspaceAuth` and `getOrganizationAuth` _return_ the
  flags for those consumers. Their own gates are `can` calls.
- **`getOrganizationAuth` gates on membership only.** Unlike `getWorkspaceAuth`,
  which redirects `billing` away from product data, the organization helper asks
  only `organization.read`. The asymmetry is required: the billing settings page
  is the `billing` role's own page, so a billing exclusion there would lock that
  role out of the one surface it exists to reach. Callers that need to exclude
  it do so themselves, via `redirectBillingRoleFromRestrictedOrgSettings`.
- **Invariants and finer rules.** An owner may not leave their organization; a
  manager may only assign the `member` role; `billing` is Cloud-only. The
  schema comments already name these as application rules — they constrain a
  request's _content_, not the principal's capability.
- **Invite fan-out.** The signup and invite paths derive from the _invited_
  role whether to create `TeamUser` rows, since owners and managers get
  workspace access from the role itself. That is a statement about the invite.
- **List scoping during the bridge.** Workspace list queries remain PostgreSQL-authoritative and narrow by
  role while the bridge is deployed. MCP `list_workspaces` has one bounded `LookupResources(workspace, read)`
  migration observation rather than one check per row. ENG-2449 replaces every current-model organization
  and workspace authorization list with an authoritative bounded lookup before the direct-authority artifact
  can ship.

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
generic Phase 2 list-resource abstraction. Current-model organization/workspace discovery is part of the
direct cutover and must not be confused with future per-resource sharing.
