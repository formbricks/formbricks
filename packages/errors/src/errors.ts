class ResourceNotFoundError extends Error {
  statusCode = 404;
  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`);
    this.name = "ResourceNotFoundError";
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

export {
  ResourceNotFoundError,
  InvalidInputError,
  ValidationError,
  DatabaseError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  OperationNotAllowedError,
  AuthenticationError,
  AuthorizationError,
};
