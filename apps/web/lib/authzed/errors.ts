import "server-only";
import { status } from "@grpc/grpc-js";

export const AUTHZED_ERROR_CODES = {
  ABORTED: "authzed_aborted",
  CANCELLED: "authzed_cancelled",
  CONFLICT: "authzed_conflict",
  DISABLED: "authzed_disabled",
  FAILED_PRECONDITION: "authzed_failed_precondition",
  INTERNAL: "authzed_internal",
  INVALID_REQUEST: "authzed_invalid_request",
  NOT_FOUND: "authzed_not_found",
  OVERLOADED: "authzed_overloaded",
  PERMISSION_DENIED: "authzed_permission_denied",
  SCHEMA_CHANGED: "authzed_schema_changed",
  SCHEMA_VERIFICATION_FAILED: "authzed_schema_verification_failed",
  TIMEOUT: "authzed_timeout",
  UNAUTHENTICATED: "authzed_unauthenticated",
  UNAVAILABLE: "authzed_unavailable",
  UNSUPPORTED: "authzed_unsupported",
} as const;

export type TAuthzedErrorCode = (typeof AUTHZED_ERROR_CODES)[keyof typeof AUTHZED_ERROR_CODES];

type TAuthzedErrorOptions = Readonly<{
  attempts: number;
  cause?: unknown;
  code: TAuthzedErrorCode;
  grpcStatus?: number;
  operation: string;
  retryable: boolean;
}>;

export class AuthzedError extends Error {
  readonly attempts: number;
  readonly cause?: unknown;
  readonly code: TAuthzedErrorCode;
  readonly grpcStatus?: number;
  readonly operation: string;
  readonly retryable: boolean;

  constructor({ attempts, cause, code, grpcStatus, operation, retryable }: TAuthzedErrorOptions) {
    super(code);
    this.name = "AuthzedError";
    this.attempts = attempts;
    this.cause = cause;
    this.code = code;
    this.grpcStatus = grpcStatus;
    this.operation = operation;
    this.retryable = retryable;
  }
}

const getGrpcStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === "number" ? code : undefined;
};

const getErrorDescriptor = (
  grpcStatus: number | undefined
): Readonly<{ code: TAuthzedErrorCode; retryable: boolean }> => {
  switch (grpcStatus) {
    case status.DEADLINE_EXCEEDED:
      return { code: AUTHZED_ERROR_CODES.TIMEOUT, retryable: true };
    case status.UNAVAILABLE:
      return { code: AUTHZED_ERROR_CODES.UNAVAILABLE, retryable: true };
    case status.RESOURCE_EXHAUSTED:
      return { code: AUTHZED_ERROR_CODES.OVERLOADED, retryable: true };
    case status.ABORTED:
      return { code: AUTHZED_ERROR_CODES.ABORTED, retryable: true };
    case status.UNAUTHENTICATED:
      return { code: AUTHZED_ERROR_CODES.UNAUTHENTICATED, retryable: false };
    case status.PERMISSION_DENIED:
      return { code: AUTHZED_ERROR_CODES.PERMISSION_DENIED, retryable: false };
    case status.INVALID_ARGUMENT:
    case status.OUT_OF_RANGE:
      return { code: AUTHZED_ERROR_CODES.INVALID_REQUEST, retryable: false };
    case status.FAILED_PRECONDITION:
      return { code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION, retryable: false };
    case status.NOT_FOUND:
      return { code: AUTHZED_ERROR_CODES.NOT_FOUND, retryable: false };
    case status.ALREADY_EXISTS:
      return { code: AUTHZED_ERROR_CODES.CONFLICT, retryable: false };
    case status.CANCELLED:
      return { code: AUTHZED_ERROR_CODES.CANCELLED, retryable: false };
    case status.UNIMPLEMENTED:
      return { code: AUTHZED_ERROR_CODES.UNSUPPORTED, retryable: false };
    default:
      return { code: AUTHZED_ERROR_CODES.INTERNAL, retryable: false };
  }
};

export const mapAuthzedError = (error: unknown, operation: string, attempts: number): AuthzedError => {
  if (error instanceof AuthzedError) {
    return new AuthzedError({
      attempts,
      cause: error.cause ?? error,
      code: error.code,
      grpcStatus: error.grpcStatus,
      operation,
      retryable: error.retryable,
    });
  }

  const grpcStatus = getGrpcStatus(error);
  const descriptor = getErrorDescriptor(grpcStatus);

  return new AuthzedError({
    attempts,
    cause: error,
    code: descriptor.code,
    grpcStatus,
    operation,
    retryable: descriptor.retryable,
  });
};
