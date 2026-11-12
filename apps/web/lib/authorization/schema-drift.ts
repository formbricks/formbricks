import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { MCP_GRANT_RELATION, MCP_REACH_PERMISSION } from "@/lib/authzed/relationship-map";

/**
 * Permissions this release adds to the AuthZed schema. Until the release's schema is applied, SpiceDB
 * still holds the previous one (6.1), which does not define them, and answers a check of one with
 * FAILED_PRECONDITION. Only a Dashboard viewer is ever asked `dashboard_read` (ADR-0025), and it must be
 * refused with a plain denial then, not a 5xx: owners and members are asked `read` and are unaffected.
 * Likewise `mcp_reach` (ADR-0042), asked only on an MCP call whose grant selects organizations or
 * workspaces: denied until the schema is applied, so such a grant reaches nothing rather than everything.
 */
const PERMISSIONS_ADDED_BY_THIS_RELEASE: ReadonlySet<string> = new Set([
  "dashboard_read",
  MCP_REACH_PERMISSION,
]);

/**
 * Relations this release adds to the AuthZed schema. On the previous one (6.1) SpiceDB rejects a write
 * that names one — and, since `WriteRelationships` is atomic, the whole batch with it. `mcp_grant` is
 * also the name of the definition its subject lives in, so a read naming it is refused the same way.
 */
const RELATIONS_ADDED_BY_THIS_RELEASE: ReadonlySet<string> = new Set([
  "dashboard_viewer",
  MCP_GRANT_RELATION,
]);

/** SpiceDB's own words for a schema element it does not have, read from the error's cause. */
const namesMissingSchemaElement = (error: AuthzedError, name: string): boolean => {
  // SpiceDB: "relation/permission `dashboard_read` not found under definition `workspace`". Any other
  // failed precondition stays an operational error.
  const cause = error.cause as { details?: unknown; message?: unknown } | undefined;
  const text = [cause?.details, cause?.message].filter((part) => typeof part === "string").join(" ");
  return text.includes(name) && text.includes("not found");
};

/**
 * Whether `error` is SpiceDB refusing a relationship write because the schema does not define
 * `relation`, for one of the relations above: SpiceDB answers that with FAILED_PRECONDITION or
 * INVALID_ARGUMENT depending on where it catches it.
 */
export const isRelationMissingFromSchema = (error: unknown, relation: string): boolean => {
  if (!RELATIONS_ADDED_BY_THIS_RELEASE.has(relation)) return false;
  if (!(error instanceof AuthzedError)) return false;
  if (
    error.code !== AUTHZED_ERROR_CODES.FAILED_PRECONDITION &&
    error.code !== AUTHZED_ERROR_CODES.INVALID_REQUEST
  )
    return false;
  return namesMissingSchemaElement(error, relation);
};

/** Whether `error` is SpiceDB saying the schema does not define `permission`, for one of the above. */
export const isPermissionMissingFromSchema = (error: unknown, permission: string): boolean => {
  if (!PERMISSIONS_ADDED_BY_THIS_RELEASE.has(permission)) return false;
  if (!(error instanceof AuthzedError) || error.code !== AUTHZED_ERROR_CODES.FAILED_PRECONDITION)
    return false;
  return namesMissingSchemaElement(error, permission);
};
