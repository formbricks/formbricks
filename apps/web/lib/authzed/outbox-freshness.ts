import "server-only";
import { cache } from "react";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { hasStaleAuthzedRevocation } from "./outbox-repository";

const getRequestCachedStaleness = cache(hasStaleAuthzedRevocation);

/**
 * Refuse to authorize from a graph that may still contain access revoked in PostgreSQL.
 *
 * This is deliberately called only by the SpiceDB evaluator. The bridge release keeps the legacy
 * evaluator authoritative while the durable queue is populated and drained; direct authority fails
 * closed once a revocation is older than the bounded delivery window or has entered dead letter.
 */
export const assertAuthzedProjectionFreshness = async (): Promise<void> => {
  if (!(await getRequestCachedStaleness())) return;

  throw new AuthzedError({
    attempts: 0,
    code: AUTHZED_ERROR_CODES.PROJECTION_STALE,
    operation: "authorization_projection_freshness",
    retryable: false,
  });
};
