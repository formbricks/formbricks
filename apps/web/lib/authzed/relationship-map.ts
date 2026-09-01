import "server-only";
import {
  ApiKeyPermission,
  OrganizationRole,
  TeamUserRole,
  WorkspaceTeamPermission,
} from "@formbricks/database/prisma";

/**
 * The single source of truth mapping PostgreSQL source values to SpiceDB relation names.
 *
 * These live here rather than privately inside each projector because reconciling tooling has to
 * derive the *expected* relationship set from the same mapping the projectors write. Two copies would
 * mean a renamed relation makes reconciliation classify a correct relationship as orphaned and, when
 * pruning, delete it — so the `owner` mapping in particular must exist exactly once.
 *
 * Every map is `satisfies Record<PrismaEnum, string>` so adding a value to a Prisma enum is a
 * compile error until it is mapped, rather than a silently unprojected role.
 *
 * Deliberately excluded: the relationship *builders*. Those encode each projector's
 * touch-the-current-value / delete-the-alternates semantics, which the expected-set derivation does
 * not want.
 */

/** `Membership.role` → `organization#<relation>@user`. Exactly one applies to a given membership. */
export const ORGANIZATION_RELATIONS = {
  [OrganizationRole.billing]: "billing",
  [OrganizationRole.manager]: "manager",
  [OrganizationRole.member]: "member",
  [OrganizationRole.owner]: "owner",
} as const satisfies Record<OrganizationRole, string>;

/** `TeamUser.role` → `team#<relation>@user`. */
export const TEAM_RELATIONS = {
  [TeamUserRole.admin]: "admin",
  [TeamUserRole.contributor]: "contributor",
} as const satisfies Record<TeamUserRole, string>;

/** `WorkspaceTeam.permission` → `workspace#<relation>@team#member`. */
export const WORKSPACE_TEAM_RELATIONS = {
  [WorkspaceTeamPermission.manage]: "manager_team",
  [WorkspaceTeamPermission.read]: "reader_team",
  [WorkspaceTeamPermission.readWrite]: "writer_team",
} as const satisfies Record<WorkspaceTeamPermission, string>;

/** `ApiKeyWorkspace.permission` → `workspace#<relation>@api_key`. */
export const WORKSPACE_API_KEY_RELATIONS = {
  [ApiKeyPermission.manage]: "manager",
  [ApiKeyPermission.read]: "reader",
  [ApiKeyPermission.write]: "writer",
} as const satisfies Record<ApiKeyPermission, string>;

/**
 * An API key's organization-level access rights.
 *
 * Unlike the role ladders these two flags are independent: a key may hold both, either, or neither.
 */
export type TOrganizationAccessSnapshot = Readonly<{
  read: boolean;
  write: boolean;
}>;

/**
 * `ApiKey.organizationAccess.accessControl.{read,write}` → `organization#<relation>@api_key`.
 *
 * Note the inverted direction relative to the workspace relations: the organization is the resource
 * and the API key is the subject.
 */
export const ORGANIZATION_ACCESS_RELATIONS = {
  read: "api_key_reader",
  write: "api_key_writer",
} as const satisfies Record<keyof TOrganizationAccessSnapshot, string>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Read an API key's organization access out of its untyped JSON column.
 *
 * Strictly `=== true`, so a missing, malformed, or non-boolean value denies — matching the current
 * evaluator rather than guessing at intent.
 */
export const normalizeOrganizationAccess = (value: unknown): TOrganizationAccessSnapshot => {
  if (!isRecord(value) || !isRecord(value.accessControl)) {
    return { read: false, write: false };
  }

  return {
    read: value.accessControl.read === true,
    write: value.accessControl.write === true,
  };
};
