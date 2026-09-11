import { AsyncLocalStorage } from "node:async_hooks";
import {
  AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
  AuthzedMutationsFencedError,
  normalizeAuthzedMutationsFencedError,
} from "@formbricks/types/errors";

export type TDatabaseOperationalErrorCode = typeof AUTHZED_MUTATIONS_FENCED_ERROR_CODE;

type TDatabaseOperationalErrorContext = {
  errorCodes: Set<TDatabaseOperationalErrorCode>;
};

const globalForDatabaseOperationalErrors = globalThis as unknown as {
  formbricksDatabaseOperationalErrorContext: AsyncLocalStorage<TDatabaseOperationalErrorContext> | undefined;
};

const databaseOperationalErrorContext =
  globalForDatabaseOperationalErrors.formbricksDatabaseOperationalErrorContext ??
  new AsyncLocalStorage<TDatabaseOperationalErrorContext>();

globalForDatabaseOperationalErrors.formbricksDatabaseOperationalErrorContext =
  databaseOperationalErrorContext;

/**
 * Establishes one request-local context. Nested boundaries deliberately reuse the outer store so a
 * database failure caught by an inner service is still observable at the transport boundary.
 */
export const withDatabaseOperationalErrorContext = <T>(callback: () => T): T => {
  if (databaseOperationalErrorContext.getStore()) return callback();

  return databaseOperationalErrorContext.run({ errorCodes: new Set() }, callback);
};

/**
 * Classifies and records a database operational error for the active request. The returned error is
 * always a new sanitized value and never retains the raw database error as its cause.
 */
export const recordDatabaseOperationalError = (error: unknown): AuthzedMutationsFencedError | null => {
  const normalizedError = normalizeAuthzedMutationsFencedError(error);
  if (!normalizedError) return null;

  databaseOperationalErrorContext.getStore()?.errorCodes.add(normalizedError.code);
  return normalizedError;
};

/** Returns whether the active request observed the specified operational failure. */
export const hasDatabaseOperationalError = (code: TDatabaseOperationalErrorCode): boolean =>
  databaseOperationalErrorContext.getStore()?.errorCodes.has(code) ?? false;

/** Returns an immutable snapshot; an empty array also represents callers outside a request context. */
export const getDatabaseOperationalErrorCodes = (): ReadonlyArray<TDatabaseOperationalErrorCode> =>
  Object.freeze(Array.from(databaseOperationalErrorContext.getStore()?.errorCodes ?? []).sort());

/**
 * Runs one transport operation and guarantees that a mutation-fence failure cannot be swallowed by
 * an inner service. The original database error never crosses this boundary.
 */
export const withDatabaseOperationalErrorBoundary = async <T>(callback: () => Promise<T>): Promise<T> =>
  withDatabaseOperationalErrorContext(async () => {
    try {
      const result = await callback();
      if (hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)) {
        throw new AuthzedMutationsFencedError();
      }
      return result;
    } catch (error) {
      const normalized = recordDatabaseOperationalError(error);
      if (normalized) throw normalized;
      if (hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)) {
        throw new AuthzedMutationsFencedError();
      }
      throw error;
    }
  });
