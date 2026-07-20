import "server-only";

export { getAuthzedClient, type TAuthzedClient, type TAuthzedSchema } from "./client";
export { isAuthzedEnabled, type TAuthzedConsistency } from "./config";
export { AuthzedError, type TAuthzedErrorCode } from "./errors";
export { checkAuthzedHealth, type TAuthzedHealthResult } from "./health";
