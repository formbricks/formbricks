import "server-only";
import { getAuthzedClient as getInternalAuthzedClient } from "./client";

/** Public facade: list lookup stays a direct-path authorization-infrastructure operation. */
export const getAuthzedClient = (): import("./client").TAuthzedClient => getInternalAuthzedClient();

export {
  type TAuthzedClient,
  type TAuthzedObjectReference,
  type TAuthzedPermissionCheck,
  type TAuthzedPermissionDecision,
  type TAuthzedRelationship,
  type TAuthzedRelationshipFilter,
  type TAuthzedRelationshipUpdate,
  type TAuthzedSchema,
  type TAuthzedSchemaDiff,
  type TAuthzedSubjectReference,
} from "./client";
export { isAuthzedEnabled, type TAuthzedConsistency } from "./config";
export { AuthzedError, type TAuthzedErrorCode } from "./errors";
export { checkAuthzedHealth, type TAuthzedHealthResult } from "./health";
export {
  applyCanonicalAuthzedSchema,
  checkCanonicalAuthzedSchema,
  type TAuthzedSchemaApplyResult,
  type TAuthzedSchemaCheckResult,
} from "./schema";
