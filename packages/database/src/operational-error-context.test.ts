import { describe, expect, test, vi } from "vitest";
import { AUTHZED_MUTATIONS_FENCED_ERROR_CODE, AuthzedMutationsFencedError } from "@formbricks/types/errors";
import {
  getDatabaseOperationalErrorCodes,
  hasDatabaseOperationalError,
  recordDatabaseOperationalError,
  withDatabaseOperationalErrorBoundary,
  withDatabaseOperationalErrorContext,
} from "./operational-error-context";

describe("database operational error context", () => {
  test("is empty outside an explicit request context", () => {
    expect(getDatabaseOperationalErrorCodes()).toEqual([]);
    expect(hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)).toBe(false);
  });

  test("records a sanitized fence error only for the active context", () => {
    withDatabaseOperationalErrorContext(() => {
      const normalized = recordDatabaseOperationalError({
        code: "P0001",
        message: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      });

      expect(normalized).toBeInstanceOf(AuthzedMutationsFencedError);
      expect(hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)).toBe(true);
      expect(getDatabaseOperationalErrorCodes()).toEqual([AUTHZED_MUTATIONS_FENCED_ERROR_CODE]);
    });

    expect(getDatabaseOperationalErrorCodes()).toEqual([]);
  });

  test("reuses the outer store across nested boundaries", () => {
    withDatabaseOperationalErrorContext(() => {
      withDatabaseOperationalErrorContext(() => {
        recordDatabaseOperationalError(new AuthzedMutationsFencedError());
      });

      expect(hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)).toBe(true);
    });
  });

  test("keeps concurrent request contexts isolated", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstCanComplete = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const [firstObserved, secondObserved] = await Promise.all([
      withDatabaseOperationalErrorContext(async () => {
        recordDatabaseOperationalError(new AuthzedMutationsFencedError());
        await firstCanComplete;
        return getDatabaseOperationalErrorCodes();
      }),
      withDatabaseOperationalErrorContext(async () => {
        await Promise.resolve();
        const observed = getDatabaseOperationalErrorCodes();
        releaseFirst?.();
        return observed;
      }),
    ]);

    expect(firstObserved).toEqual([AUTHZED_MUTATIONS_FENCED_ERROR_CODE]);
    expect(secondObserved).toEqual([]);
  });

  test("does not record unrelated failures", () => {
    withDatabaseOperationalErrorContext(() => {
      expect(recordDatabaseOperationalError(new Error("database unavailable"))).toBeNull();
      expect(getDatabaseOperationalErrorCodes()).toEqual([]);
    });
  });

  test("surfaces a fence failure swallowed by an inner service", async () => {
    await expect(
      withDatabaseOperationalErrorBoundary(() => {
        recordDatabaseOperationalError(new AuthzedMutationsFencedError());
        return Promise.resolve({ falselyReportedAsSuccess: true });
      })
    ).rejects.toMatchObject({ code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE, statusCode: 503 });
  });

  test("preserves an unrelated error when no fence was observed", async () => {
    const failure = new Error("unrelated failure");
    await expect(withDatabaseOperationalErrorBoundary(() => Promise.reject(failure))).rejects.toBe(failure);
  });

  test("reuses the AsyncLocalStorage instance across module reloads", async () => {
    const firstModule = await import("./operational-error-context");

    await firstModule.withDatabaseOperationalErrorContext(async () => {
      firstModule.recordDatabaseOperationalError(new AuthzedMutationsFencedError());
      vi.resetModules();
      const reloadedModule = await import("./operational-error-context");

      expect(reloadedModule.hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)).toBe(true);
    });
  });
});
