import { describe, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { handleClientResponseCreateError } from "./response-error";

// Real Prisma 7 + adapter-pg P2002 shape (no meta.target; columns nested under the driver adapter).
const uniqueViolation = (fields: string[]): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { driverAdapterError: { cause: { constraint: { fields } } } },
  });

describe("handleClientResponseCreateError", () => {
  test("maps a displayId unique violation to InvalidInputError (with the display id)", () => {
    expect(() => handleClientResponseCreateError(uniqueViolation(["displayId"]), "disp_123")).toThrow(
      new InvalidInputError("Display disp_123 is already linked to a response")
    );
  });

  test("maps a singleUseId unique violation to UniqueConstraintError", () => {
    expect(() => handleClientResponseCreateError(uniqueViolation(["surveyId", "singleUseId"]))).toThrow(
      UniqueConstraintError
    );
  });

  test("maps any other known Prisma error to DatabaseError carrying its message", () => {
    const error = new Prisma.PrismaClientKnownRequestError("boom", { code: "P2025", clientVersion: "test" });
    expect(() => handleClientResponseCreateError(error)).toThrow(new DatabaseError("boom"));
  });

  test("re-throws a non-Prisma error unchanged", () => {
    const error = new Error("plain");
    expect(() => handleClientResponseCreateError(error)).toThrow(error);
  });
});
