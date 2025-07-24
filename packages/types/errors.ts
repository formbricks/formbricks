import { z } from "zod";

class ResourceNotFoundError extends Error {
  statusCode = 404;
  resourceId: string | null;
  resourceType: string;

  constructor(resource: string, id: string | null) {
    super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
    this.name = "ResourceNotFoundError";
    this.resourceType = resource;
    this.resourceId = id;
  }
}

class InvalidInputError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

class ValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class UnknownError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

class DatabaseError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

class UniqueConstraintError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "UniqueConstraintError";
  }
}

class ForeignKeyConstraintError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ForeignKeyConstraintError";
  }
}

class OperationNotAllowedError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "OperationNotAllowedError";
  }
}

class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

class TooManyRequestsError extends Error {
  statusCode = 429;
  constructor(message: string) {
    super(message);
    this.name = "TooManyRequestsError";
  }
}

interface NetworkError {
  code: "network_error";
  message: string;
  status: number;
  url: URL;
  responseMessage?: string;
  details?: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
}

interface ForbiddenError {
  code: "forbidden";
  message: string;
  status: number;
  url: URL;
  responseMessage?: string;
  details?: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
}

export const ZErrorHandler = z.function().args(z.any()).returns(z.void());

export {
  ResourceNotFoundError,
  InvalidInputError,
  ValidationError,
  DatabaseError,
  UniqueConstraintError,
  UnknownError,
  ForeignKeyConstraintError,
  OperationNotAllowedError,
  AuthenticationError,
  AuthorizationError,
  TooManyRequestsError,
};
export type { NetworkError, ForbiddenError };

export interface ApiErrorResponse {
  code:
    | "not_found"
    | "gone"
    | "bad_request"
    | "internal_server_error"
    | "unauthorized"
    | "method_not_allowed"
    | "not_authenticated"
    | "forbidden"
    | "network_error"
    | "too_many_requests";
  message: string;
  status: number;
  url?: URL;
  details?: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
  responseMessage?: string;
}

/**
 * Error types for UI display
 */
export type ClientErrorType = "rate_limit" | "general";

export interface ClientErrorData {
  /** Error type to determine which translations to use */
  type: ClientErrorType;
  /** Whether to show action buttons */
  showButtons?: boolean;
}

/**
 * Helper function to get error data from any error for UI display
 */
export const getClientErrorData = (error: Error): ClientErrorData => {
  // Check by error name as fallback (in case instanceof fails due to module loading issues)
  if (error.name === "TooManyRequestsError") {
    return {
      type: "rate_limit",
      showButtons: false,
    };
  }

  // Default to general error for any other error
  return {
    type: "general",
    showButtons: true,
  };
};
