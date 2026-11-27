import "server-only";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { stackFrames } from "@/lib/utils/loggable-error";

const nameOf = (value: unknown): string => {
  if (value instanceof Error) return typeof value.name === "string" ? value.name : "Error";
  return value === null ? "null" : typeof value;
};

const grpcStatusOf = (value: unknown): number | undefined => {
  if (typeof value !== "object" || value === null || !("code" in value)) return undefined;
  return typeof value.code === "number" ? value.code : undefined;
};

/**
 * Stands in for the failure under an authorization error as its `cause` (ENG-7041). Sentry and the API
 * error reporter follow `cause`, so this is how a report tells a SpiceDB transport fault from a bug of
 * ours: the original name, its gRPC status when it has one, and its frames under a header of its own.
 * Nothing the failure filled in rides along (no message, no fields such as gRPC metadata, no `cause`),
 * so the original is not exposed to whatever logs the error whole.
 */
export class AuthorizationFailureCause extends Error {
  readonly originalName: string;
  readonly grpcStatus?: number;

  constructor(original: unknown) {
    const originalName = nameOf(original);
    const grpcStatus = grpcStatusOf(original);
    super(
      `Authorization failed with ${originalName}${
        grpcStatus === undefined ? "" : ` (gRPC status ${String(grpcStatus)})`
      }; its message is withheld`
    );
    this.name = "AuthorizationFailureCause";
    this.originalName = originalName;
    if (grpcStatus !== undefined) {
      this.grpcStatus = grpcStatus;
    }

    // The original's frames, so the report points at the failing call rather than at this line.
    const frames = original instanceof Error ? stackFrames(original) : [];
    if (frames.length > 0) {
      this.stack = [`${this.name}: ${this.message}`, ...frames].join("\n");
    }
  }
}

/**
 * Re-labels a failure with the authorization operation. The failure underneath (the gRPC error an
 * AuthzedError wraps, or whatever else was thrown) becomes an `AuthorizationFailureCause`, never the
 * original object. The message stays the bare code.
 */
export const normalizeAuthorizationOperationalError = (error: unknown, operation: string): AuthzedError => {
  if (error instanceof AuthzedError) {
    return new AuthzedError({
      attempts: error.attempts,
      cause: new AuthorizationFailureCause(error.cause ?? error),
      code: error.code,
      grpcStatus: error.grpcStatus,
      operation,
      retryable: error.retryable,
    });
  }

  return new AuthzedError({
    attempts: 1,
    cause: new AuthorizationFailureCause(error),
    code: AUTHZED_ERROR_CODES.INTERNAL,
    operation,
    retryable: false,
  });
};
