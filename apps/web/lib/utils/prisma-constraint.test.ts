import { describe, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { getUniqueConstraintFields, isUniqueConstraintError } from "./prisma-constraint";

const knownError = (code: string, meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test", meta });

// The shape Prisma 7 + @prisma/adapter-pg actually produces (verified against a real P2002): no
// top-level `target`; the columns are nested under driverAdapterError.cause.constraint.fields.
const adapterP2002 = (fields: string[]): Prisma.PrismaClientKnownRequestError =>
  knownError("P2002", {
    modelName: "User",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        kind: "UniqueConstraintViolation",
        originalCode: "23505",
        originalMessage: `duplicate key value violates unique constraint "User_${fields.join("_")}_key"`,
        constraint: { fields },
      },
    },
  });

// The legacy / library-engine shape (top-level target). Still supported as a fallback.
const legacyP2002 = (target: string[]): Prisma.PrismaClientKnownRequestError =>
  knownError("P2002", { target });

describe("isUniqueConstraintError", () => {
  test("is true only for P2002", () => {
    expect(isUniqueConstraintError(adapterP2002(["email"]))).toBe(true);
    expect(isUniqueConstraintError(knownError("P2025"))).toBe(false);
    expect(isUniqueConstraintError(new Error("plain"))).toBe(false);
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});

describe("getUniqueConstraintFields", () => {
  test("extracts columns from the Prisma 7 driver-adapter shape (no meta.target)", () => {
    expect(adapterP2002(["email"]).meta?.target).toBeUndefined(); // guards the premise of the bug
    expect(getUniqueConstraintFields(adapterP2002(["email"]))).toEqual(["email"]);
    expect(getUniqueConstraintFields(adapterP2002(["responseId", "tagId"]))).toEqual(["responseId", "tagId"]);
  });

  test("extracts columns from the legacy top-level meta.target shape", () => {
    expect(getUniqueConstraintFields(legacyP2002(["email"]))).toEqual(["email"]);
  });

  test("returns [] when neither shape is present (callers must still map to conflict, not 500)", () => {
    expect(getUniqueConstraintFields(knownError("P2002"))).toEqual([]);
    expect(getUniqueConstraintFields(knownError("P2002", { modelName: "User" }))).toEqual([]);
  });

  test("filters out non-string entries defensively", () => {
    expect(getUniqueConstraintFields(legacyP2002(["email", null as unknown as string]))).toEqual(["email"]);
  });
});
