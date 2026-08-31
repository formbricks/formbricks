import "server-only";
import { returnValidationErrors } from "next-safe-action";
import { ZodIssue, z } from "zod";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { type TOrganizationRole } from "@formbricks/types/memberships";
import {
  type TAuthorizationAction,
  type TAuthorizationActor,
  type TAuthorizationResource,
  can,
} from "@/lib/authorization";
import { getWorkspaceActionForPermission } from "@/lib/authorization/compatibility";
import { type TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

export const formatErrors = (issues: ZodIssue[]): Record<string, { _errors: string[] }> => {
  return {
    ...issues.reduce<Record<string, { _errors: string[] }>>((acc, issue) => {
      acc[issue.path.join(".")] = {
        _errors: [issue.message],
      };
      return acc;
    }, {}),
  };
};

/**
 * The legacy action-client access shapes, each of which maps onto exactly one action in
 * the central vocabulary.
 *
 * The `team` shape was removed under ENG-1737: no call site used it, and the only role it
 * could express beyond `team.manage` was bare team membership, which is not an action the
 * current contract exposes. Leaving it in the union would have meant a shape that type-checks
 * and then quietly denies.
 */
export type TAccess<T extends z.ZodRawShape> =
  | {
      type: "organization";
      schema?: z.ZodObject<T>;
      data?: z.ZodObject<T>["_output"];
      roles: TOrganizationRole[];
    }
  | {
      type: "workspaceTeam";
      minPermission?: TTeamPermission;
      workspaceId: string;
    };

type TOrganizationAction = Extract<TAuthorizationAction, `organization.${string}`>;
type TUserActor = Extract<TAuthorizationActor, { type: "user" }>;
type TOrganizationResource = Extract<TAuthorizationResource, { type: "organization" }>;

/**
 * Every organization role set the action clients express, keyed by its sorted members.
 *
 * These five sets are exhaustive over the repository: each one is the membership of exactly
 * one organization permission in the schema, which is why the translation is lossless.
 * A set outside this table has no defined meaning, so it is refused rather than guessed at
 * (see {@link getOrganizationAction}).
 */
const ORGANIZATION_ACTION_BY_ROLE_SET: Readonly<Record<string, TOrganizationAction>> = {
  "billing,manager,member,owner": "organization.read",
  "manager,member,owner": "organization.read_access",
  "billing,manager,owner": "organization.manage_billing",
  "manager,owner": "organization.manage",
  owner: "organization.write",
};

const byCodeUnit = (roleA: string, roleB: string): number => {
  if (roleA < roleB) return -1;
  return roleA > roleB ? 1 : 0;
};

const getOrganizationAction = (roles: TOrganizationRole[]): TOrganizationAction | null => {
  const roleSet = [...new Set(roles)].sort(byCodeUnit).join(",");
  const action = ORGANIZATION_ACTION_BY_ROLE_SET[roleSet];

  if (!action) {
    // Fail closed, and say so. An unmapped set means an action client asked for a rule the
    // central vocabulary cannot express, which is a bug in the caller rather than a decision
    // about this request — the caller is refused, but silence would let it look like an
    // ordinary denial. The role set is a fixed enum combination, never an identifier.
    logger.error({ roleSet }, "Unmapped organization role set in action-client authorization");
    return null;
  }

  return action;
};

const getOrganizationValidationError = <T extends z.ZodRawShape>(accessItem: TAccess<T>) => {
  if (accessItem.type !== "organization" || !accessItem.schema) return null;

  const resultSchema = accessItem.schema.strict();
  const parsedResult = resultSchema.safeParse(accessItem.data);
  if (parsedResult.success) return null;

  // @ts-expect-error -- match dynamic next-safe-action types
  return returnValidationErrors(resultSchema, formatErrors(parsedResult.error.issues));
};

const checkAccessItem = async <T extends z.ZodRawShape>(
  accessItem: TAccess<T>,
  actor: TUserActor,
  organization: TOrganizationResource
) => {
  if (accessItem.type === "organization") {
    const validationError = getOrganizationValidationError(accessItem);
    if (validationError) return validationError;

    const action = getOrganizationAction(accessItem.roles);
    // `organization.read` is "holds any membership role", which the caller has already
    // established for this request; re-asking would be a second identical check.
    if (action === "organization.read") return true;
    return action ? can(actor, action, organization) : false;
  }

  if (
    accessItem.minPermission !== undefined &&
    !(["read", "readWrite", "manage"] as const).includes(accessItem.minPermission)
  ) {
    return false;
  }

  const action = getWorkspaceActionForPermission(accessItem.minPermission);
  return can(actor, action, { type: "workspace", id: accessItem.workspaceId });
};

/**
 * Compatibility adapter for the pre-ENG-1712 action-client authorization signature.
 *
 * Every decision now goes through `can`. ENG-1737 removed the parallel legacy evaluator
 * this used to fall back to: it was reachable only for shapes no call site produced, and
 * for the live shapes the central path is a superset of it (organization role sets map onto
 * the identically-defined schema permission, and the workspace ladder additionally admits
 * owners and managers through `organization#manage`, which the organization item in those
 * same shapes already admitted). Keeping both meant two implementations of one rule.
 *
 * @deprecated New code must call `can` or `assertCan` with a semantic action and resource
 * rather than adding a caller here.
 */
export const checkAuthorizationUpdated = async <T extends z.ZodRawShape>({
  userId,
  organizationId,
  access,
}: {
  userId: string;
  organizationId: string;
  access: TAccess<T>[];
}) => {
  const actor = { type: "user", id: userId } as const;
  const organization = { type: "organization", id: organizationId } as const;

  if (!(await can(actor, "organization.read", organization))) {
    throw new AuthorizationError("Not authorized");
  }

  for (const accessItem of access) {
    const accessResult = await checkAccessItem(accessItem, actor, organization);
    if (accessResult) return accessResult;
  }

  // Reached when no item matched, and also when `access` is empty — an empty requirement
  // list must not read as "no requirements".
  throw new AuthorizationError("Not authorized");
};
