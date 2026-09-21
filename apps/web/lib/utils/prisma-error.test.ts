import { afterEach, describe, expect, test, vi } from "vitest";
import { Prisma, type PrismaClientKnownRequestError } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import {
  isPrismaKnownRequestError,
  isTransactionConflictError,
  isUniqueConstraintError,
  retryOnTransactionConflict,
} from "./prisma-error";

const knownError = (code: string): PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test" });

const uniqueViolation = knownError(PrismaErrorType.UniqueConstraintViolation);
const recordNotFound = knownError(PrismaErrorType.RelatedRecordNotFound);

describe("isPrismaKnownRequestError", () => {
  test("matches any known request error when no code is given", () => {
    expect(isPrismaKnownRequestError(uniqueViolation)).toBe(true);
    expect(isPrismaKnownRequestError(recordNotFound)).toBe(true);
  });

  test("narrows to a specific code", () => {
    expect(isPrismaKnownRequestError(uniqueViolation, PrismaErrorType.UniqueConstraintViolation)).toBe(true);
    expect(isPrismaKnownRequestError(recordNotFound, PrismaErrorType.UniqueConstraintViolation)).toBe(false);
  });

  test("is false for non-Prisma errors and look-alikes", () => {
    expect(isPrismaKnownRequestError(new Error("plain"))).toBe(false);
    expect(isPrismaKnownRequestError({ code: "P2002" })).toBe(false);
    expect(isPrismaKnownRequestError(null)).toBe(false);
    expect(isPrismaKnownRequestError(undefined)).toBe(false);
  });
});

describe("isUniqueConstraintError", () => {
  test("is true only for a P2002 unique-constraint violation", () => {
    expect(isUniqueConstraintError(uniqueViolation)).toBe(true);
    expect(isUniqueConstraintError(recordNotFound)).toBe(false);
    expect(isUniqueConstraintError(new Error("plain"))).toBe(false);
  });
});

describe("type narrowing", () => {
  test("narrows to PrismaClientKnownRequestError so callers can read code/meta", () => {
    const error: unknown = new Prisma.PrismaClientKnownRequestError("dup", {
      code: PrismaErrorType.UniqueConstraintViolation,
      clientVersion: "test",
      meta: { target: ["email"] },
    });

    if (isUniqueConstraintError(error)) {
      // These accesses must compile (proves the guard yields PrismaClientKnownRequestError,
      // not the namespaced type that resolves to `any`) and be correct at runtime.
      expect(error.code).toBe("P2002");
      expect(error.meta?.target).toEqual(["email"]);
    } else {
      throw new Error("expected isUniqueConstraintError to narrow");
    }
  });

  test("the negative branch stays usable (regression guard against never-collapse)", () => {
    const error: unknown = new Error("plain");

    if (isPrismaKnownRequestError(error)) {
      throw new Error("unexpected");
    }

    // The guard must return false for a plain Error, leaving `error` usable. The compile-time
    // counterpart of this regression is enforced by the refactored source files: if the helper
    // predicate used the namespaced `Prisma.PrismaClientKnownRequestError` (which is `any` in
    // type position), their post-guard `error.message` accesses would narrow to `never` and fail
    // typecheck.
    expect(error).toBeInstanceOf(Error);
  });
});

describe("isTransactionConflictError", () => {
  test("is true for a P2034 transaction conflict", () => {
    expect(isTransactionConflictError(knownError(PrismaErrorType.TransactionConflict))).toBe(true);
  });

  test("is true for a deadlock the driver adapter surfaces as a plain error", () => {
    expect(isTransactionConflictError(new Error("deadlock detected"))).toBe(true);
    expect(isTransactionConflictError(new Error("SQLSTATE 40P01"))).toBe(true);
  });

  test("is false for other errors", () => {
    expect(isTransactionConflictError(uniqueViolation)).toBe(false);
    expect(isTransactionConflictError(new Error("plain"))).toBe(false);
    expect(isTransactionConflictError(null)).toBe(false);
  });
});

describe("retryOnTransactionConflict", () => {
  const conflict = knownError(PrismaErrorType.TransactionConflict);

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns the first successful result", async () => {
    const operation = vi.fn().mockResolvedValue("ok");

    await expect(retryOnTransactionConflict(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test("runs the operation again after a conflict, with a backoff in between", async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValue("ok");

    const result = retryOnTransactionConflict(operation);
    await vi.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(25);
    await expect(result).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test("gives up after maxAttempts and rethrows the last conflict", async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValue(conflict);

    const assertion = expect(retryOnTransactionConflict(operation, { maxAttempts: 3 })).rejects.toBe(
      conflict
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(3);
  });

  test("rethrows a non-conflict error at once", async () => {
    const failure = new Error("plain");
    const operation = vi.fn().mockRejectedValue(failure);

    await expect(retryOnTransactionConflict(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
