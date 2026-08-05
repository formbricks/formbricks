import { describe, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { isDatabasePoolExhaustionError } from "./pool-exhaustion";

describe("isDatabasePoolExhaustionError", () => {
  test("is true for the Prisma P2024 pool-timeout code", () => {
    const error = new Prisma.PrismaClientKnownRequestError("pool timeout", {
      code: "P2024",
      clientVersion: "test",
    });
    expect(isDatabasePoolExhaustionError(error)).toBe(true);
  });

  test("is true for a connection-pool timeout message (plain Error or DatabaseError)", () => {
    expect(
      isDatabasePoolExhaustionError(new Error("Timed out fetching a new connection from the connection pool"))
    ).toBe(true);
    expect(isDatabasePoolExhaustionError(new DatabaseError("connection pool timeout while querying"))).toBe(
      true
    );
  });

  test("is false for other Prisma codes, unrelated messages, and non-errors", () => {
    const notFound = new Prisma.PrismaClientKnownRequestError("not found", {
      code: "P2025",
      clientVersion: "test",
    });
    expect(isDatabasePoolExhaustionError(notFound)).toBe(false);
    expect(isDatabasePoolExhaustionError(new Error("something unrelated"))).toBe(false);
    expect(isDatabasePoolExhaustionError("nope")).toBe(false);
    expect(isDatabasePoolExhaustionError(null)).toBe(false);
    expect(isDatabasePoolExhaustionError(undefined)).toBe(false);
  });
});
