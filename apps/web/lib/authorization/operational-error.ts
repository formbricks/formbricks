import "server-only";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";

/**
 * Re-labels a failure with the authorization operation, keeping the original as `cause`: Sentry follows
 * it, and it is the only place the gRPC details, or a bug of ours that is no AuthZed fault at all, survive
 * (ENG-7041). The message stays the bare code, so nothing raw reaches the message or the stack.
 */
export const normalizeAuthorizationOperationalError = (error: unknown, operation: string): AuthzedError => {
  if (error instanceof AuthzedError) {
    return new AuthzedError({
      attempts: error.attempts,
      cause: error.cause ?? error,
      code: error.code,
      grpcStatus: error.grpcStatus,
      operation,
      retryable: error.retryable,
    });
  }

  return new AuthzedError({
    attempts: 1,
    cause: error,
    code: AUTHZED_ERROR_CODES.INTERNAL,
    operation,
    retryable: false,
  });
};
