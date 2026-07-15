import { describe, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { handleClientResponseCreateError } from "./response-error";

const uniqueConstraintError = (target: string[]): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });

describe("handleClientResponseCreateError", () => {
  test("maps a displayId unique-constraint violation to InvalidInputError (with the display id)", () => {
    expect(() => handleClientResponseCreateError(uniqueConstraintError(["displayId"]), "disp_123")).toThrow(
      new InvalidInputError("Display disp_123 is already linked to a response")
    );
  });

  test("maps a singleUseId unique-constraint violation to UniqueConstraintError", () => {
    expect(() => handleClientResponseCreateError(uniqueConstraintError(["singleUseId"]))).toThrow(
      UniqueConstraintError
    );
  });

  test("maps any other known Prisma error to DatabaseError carrying its message", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Record to create not found", {
      code: "P2025",
      clientVersion: "test",
    });
    expect(() => handleClientResponseCreateError(error)).toThrow(
      new DatabaseError("Record to create not found")
    );
  });

  test("re-throws a non-Prisma error unchanged", () => {
    const error = new Error("boom");
    expect(() => handleClientResponseCreateError(error)).toThrow(error);
  });
});
