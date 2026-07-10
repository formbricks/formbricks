import { describe, expect, test } from "vitest";
import { PrismaErrorType } from "../types/error";
import {
  isForeignKeyConstraintError,
  isPrismaKnownRequestError,
  isUniqueConstraintError,
  prismaErrorMetaIncludes,
} from "./errors";
import { PrismaClientKnownRequestError } from "./prisma";

// Construct via the named `PrismaClientKnownRequestError` class (a real type), NOT the namespaced
// `Prisma.PrismaClientKnownRequestError` (which resolves to `any` and trips no-unsafe-* under the
// package's strict eslint config).
const knownError = (code: string, meta?: Record<string, unknown>): PrismaClientKnownRequestError =>
  new PrismaClientKnownRequestError("boom", { code, clientVersion: "test", meta });

const uniqueViolation = knownError(PrismaErrorType.UniqueConstraintViolation);
const foreignKeyViolation = knownError(PrismaErrorType.ForeignKeyConstraintViolation);
const recordNotFound = knownError(PrismaErrorType.RecordNotFound);

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
    expect(isUniqueConstraintError(foreignKeyViolation)).toBe(false);
    expect(isUniqueConstraintError(recordNotFound)).toBe(false);
    expect(isUniqueConstraintError(new Error("plain"))).toBe(false);
  });
});

describe("isForeignKeyConstraintError", () => {
  test("is true only for a P2003 foreign-key-constraint violation", () => {
    expect(isForeignKeyConstraintError(foreignKeyViolation)).toBe(true);
    expect(isForeignKeyConstraintError(uniqueViolation)).toBe(false);
    expect(isForeignKeyConstraintError(recordNotFound)).toBe(false);
    expect(isForeignKeyConstraintError(new Error("plain"))).toBe(false);
  });
});

describe("prismaErrorMetaIncludes", () => {
  // The real P2003 meta produced by Prisma 7 + @prisma/adapter-pg: the constraint name is nested
  // deep under driverAdapterError.cause, NOT at the top level.
  const nestedAdapterError = knownError(PrismaErrorType.ForeignKeyConstraintViolation, {
    modelName: "FeedbackSource",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        kind: "ForeignKeyConstraintViolation",
        originalCode: "23503",
        originalMessage:
          'insert or update on table "FeedbackSource" violates foreign key constraint "FeedbackSource_feedbackDirectoryId_workspaceId_fkey"',
        constraint: { index: "FeedbackSource_feedbackDirectoryId_workspaceId_fkey" },
      },
    },
  });

  // The flatter shape that only exposes the model + columns (no constraint name).
  const flatFieldNameError = knownError(PrismaErrorType.ForeignKeyConstraintViolation, {
    modelName: "FeedbackSource",
    field_name: "feedbackDirectoryId_workspaceId",
  });

  test("finds a constraint name nested deep in the driver-adapter meta shape", () => {
    expect(
      prismaErrorMetaIncludes(nestedAdapterError, "FeedbackSource_feedbackDirectoryId_workspaceId_fkey")
    ).toBe(true);
  });

  test("requires all needles to be present (AND semantics)", () => {
    expect(
      prismaErrorMetaIncludes(nestedAdapterError, "FeedbackSource", "feedbackDirectoryId", "workspaceId")
    ).toBe(true);
    expect(prismaErrorMetaIncludes(nestedAdapterError, "FeedbackSource", "notARealColumn")).toBe(false);
  });

  test("scans the flat field_name shape too", () => {
    expect(prismaErrorMetaIncludes(flatFieldNameError, "FeedbackSource", "feedbackDirectoryId")).toBe(true);
    expect(
      prismaErrorMetaIncludes(flatFieldNameError, "FeedbackSource_feedbackDirectoryId_workspaceId_fkey")
    ).toBe(false);
  });

  test("returns false (never throws) when meta is undefined", () => {
    expect(prismaErrorMetaIncludes(foreignKeyViolation, "anything")).toBe(false);
  });

  test("returns true for zero needles (vacuous truth)", () => {
    expect(prismaErrorMetaIncludes(nestedAdapterError)).toBe(true);
  });
});

describe("type narrowing", () => {
  test("narrows to PrismaClientKnownRequestError so callers can read code/meta", () => {
    const error: unknown = new PrismaClientKnownRequestError("dup", {
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
