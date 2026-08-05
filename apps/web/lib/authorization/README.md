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

### Assigned to ENG-1731

- API-key principals in V1, V2, V3, MCP, and storage authorization paths.
- `ApiKeyWorkspace` permissions and organization access-control flags.
- Organization-only API-key opt-in and API-key revocation behavior.

### Assigned to ENG-1737

- The broad, non-action-aware `hasUserWorkspaceAccess` navigation helper.
- Layout and UI-derived access flags.
- Unrecognized action-client compatibility shapes and remaining
  feature-specific role checks.

New authorization-sensitive code must use `can` or `assertCan`; it must not add
callers to the compatibility fallback or broad workspace helper.

## Explicit exclusions

The current contract has no system/service principal, survey-level sharing,
per-dashboard ACL, audit-log permission, contextual data-policy capability, or
generic list-resource lookup. Those require later product decisions and must
not be added as part of the current-model migration.
