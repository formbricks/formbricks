import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/** A UI action and the native endpoint it calls share one correlation ID. */
export const securityAuditRequestContext = new AsyncLocalStorage<string>();
