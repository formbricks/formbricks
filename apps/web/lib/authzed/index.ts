import "server-only";

export {
  getAuthzedClient,
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
