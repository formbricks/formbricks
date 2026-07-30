import { describe, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "./prisma-error";

const knownError = (code: string): Prisma.PrismaClientKnownRequestError =>
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
