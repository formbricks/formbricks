import "server-only";

export {
  getAuthzedClient,
  type TAuthzedClient,
  type TAuthzedSchema,
  type TAuthzedSchemaDiff,
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
