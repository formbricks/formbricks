import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";

/**
 * Permissions this release adds to the AuthZed schema. Until the release's schema is applied, SpiceDB
 * still holds the previous one (6.1), which does not define them, and answers a check of one with
 * FAILED_PRECONDITION. Only a Dashboard viewer is ever asked `dashboard_read` (ADR-0025), and it must be
 * refused with a plain denial then, not a 5xx: owners and members are asked `read` and are unaffected.
 */
const PERMISSIONS_ADDED_BY_THIS_RELEASE: ReadonlySet<string> = new Set(["dashboard_read"]);

/** Whether `error` is SpiceDB saying the schema does not define `permission`, for one of the above. */
export const isPermissionMissingFromSchema = (error: unknown, permission: string): boolean => {
  if (!PERMISSIONS_ADDED_BY_THIS_RELEASE.has(permission)) return false;
  if (!(error instanceof AuthzedError) || error.code !== AUTHZED_ERROR_CODES.FAILED_PRECONDITION)
    return false;
  // SpiceDB: "relation/permission `dashboard_read` not found under definition `workspace`". Any other
  // failed precondition stays an operational error.
  const cause = error.cause as { details?: unknown; message?: unknown } | undefined;
  const text = [cause?.details, cause?.message].filter((part) => typeof part === "string").join(" ");
  return text.includes(permission) && text.includes("not found");
};
