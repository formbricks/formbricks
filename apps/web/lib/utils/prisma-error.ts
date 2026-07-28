import { Prisma } from "@formbricks/database/prisma";
import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";

/**
 * Type guard for Prisma "known request" errors, optionally narrowed to a specific error code.
 * Returns a type predicate so callers can read `error.code`/`error.meta` after the check.
 *
 * Note: the predicate uses the named `PrismaClientKnownRequestError` type (not the namespaced
 * `Prisma.PrismaClientKnownRequestError`, which resolves to `any` in type position and would
 * collapse the negative branch of the guard to `never`).
 */
export const isPrismaKnownRequestError = (
  error: unknown,
  code?: PrismaErrorType
): error is PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && (code === undefined || error.code === code);

/** Type guard for a Prisma unique-constraint violation (P2002). */
export const isUniqueConstraintError = (error: unknown): error is PrismaClientKnownRequestError =>
  isPrismaKnownRequestError(error, PrismaErrorType.UniqueConstraintViolation);
