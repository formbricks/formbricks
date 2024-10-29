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
    this.name = "DatabaseError";
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

interface NetworkError {
  code: "network_error";
  message: string;
  status: number;
  url: URL;
}

interface ForbiddenError {
  code: "forbidden";
  message: string;
  responseMessage?: string;
  status: number;
  url: URL;
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
};
export type { NetworkError, ForbiddenError };
