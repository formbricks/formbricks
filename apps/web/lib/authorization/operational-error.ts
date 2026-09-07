import "server-only";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";

export const normalizeAuthorizationOperationalError = (error: unknown, operation: string): AuthzedError => {
  if (error instanceof AuthzedError) {
    return new AuthzedError({
      attempts: error.attempts,
      code: error.code,
      grpcStatus: error.grpcStatus,
      operation,
      retryable: error.retryable,
    });
  }

  return new AuthzedError({
    attempts: 1,
    code: AUTHZED_ERROR_CODES.INTERNAL,
    operation,
    retryable: false,
  });
};
