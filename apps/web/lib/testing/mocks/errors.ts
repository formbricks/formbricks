import { Prisma } from "@prisma/client";

/**
 * Factory function to create Prisma errors with a specific error code and message.
 * Eliminates 100+ lines of repetitive Prisma error setup across test files.
 *
 * @param code - The Prisma error code (e.g., "P2002", "P2025")
 * @param message - Optional error message (defaults to "Database error")
 * @returns A PrismaClientKnownRequestError instance
 *
 * @example
 * ```typescript
 * import { createPrismaError } from "@/lib/testing/mocks";
 *
 * vi.mocked(prisma.contact.findMany).mockRejectedValue(
 *   createPrismaError("P2002", "Unique constraint failed")
 * );
 * ```
 */
export function createPrismaError(code: string, message = "Database error") {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "5.0.0",
  });
}

/**
 * Pre-built common Prisma errors for convenience.
 * Use these instead of creating errors manually every time.
 *
 * @example
 * ```typescript
 * import { COMMON_ERRORS } from "@/lib/testing/mocks";
 *
 * vi.mocked(prisma.contact.findUnique).mockRejectedValue(
 *   COMMON_ERRORS.RECORD_NOT_FOUND
 * );
 * ```
 */
export const COMMON_ERRORS = {
  // P2002: Unique constraint failed
  UNIQUE_CONSTRAINT: createPrismaError("P2002", "Unique constraint violation"),

  // P2025: Record not found
  RECORD_NOT_FOUND: createPrismaError("P2025", "Record not found"),

  // P2003: Foreign key constraint failed
  FOREIGN_KEY: createPrismaError("P2003", "Foreign key constraint failed"),

  // P2014: Required relation violation
  REQUIRED_RELATION: createPrismaError("P2014", "Required relation violation"),

  // Generic database error
  DATABASE_ERROR: createPrismaError("P5000", "Database connection error"),
} as const;

/**
 * Validation error mock for non-database validation failures.
 * Use this for validation errors in service layers.
 *
 * @example
 * ```typescript
 * import { ValidationError } from "@formbricks/types/errors";
 *
 * vi.mocked(validateInputs).mockImplementation(() => {
 *   throw new ValidationError("Invalid input");
 * });
 * ```
 */
export class MockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Custom error types that match Formbricks domain errors.
 */
export class MockDatabaseError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class MockNotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

export class MockAuthorizationError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}
