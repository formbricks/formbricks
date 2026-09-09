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

/**
 * True for a transaction the database aborted over a clash with a concurrent one, which is safe to
 * run again: a `Serializable` write conflict or a deadlock. Prisma reports both as P2034 on an
 * interactive transaction; the pg driver adapter can also surface a deadlock as a plain error whose
 * message carries "deadlock detected" or SQLSTATE 40P01 (the shape seen in Sentry for ENG-2038).
 */
export const isTransactionConflictError = (error: unknown): boolean => {
  if (isPrismaKnownRequestError(error, PrismaErrorType.TransactionConflict)) {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /deadlock detected/i.test(message) || message.includes("40P01");
};

const DEFAULT_MAX_TRANSACTION_ATTEMPTS = 3;
const TRANSACTION_RETRY_BACKOFF_MS = 25;

/**
 * Runs `operation` again when it fails with a transaction conflict, `maxAttempts` times in total, with
 * a short linear backoff so the retries do not re-collide in lockstep. Any other error, and the last
 * conflict, propagate unchanged.
 *
 * A conflict aborts the whole transaction, so wrap the `prisma.$transaction(...)` call itself and keep
 * the operation idempotent: every attempt re-reads and re-writes from scratch.
 */
export const retryOnTransactionConflict = async <T>(
  operation: () => Promise<T>,
  { maxAttempts = DEFAULT_MAX_TRANSACTION_ATTEMPTS }: { maxAttempts?: number } = {}
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isTransactionConflictError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * TRANSACTION_RETRY_BACKOFF_MS));
    }
  }
};
