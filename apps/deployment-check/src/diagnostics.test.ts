import { describe, expect, test } from "vitest";
import { authFailure, describeHealthFailures, failingHealthComponents } from "./diagnostics.ts";

describe("failingHealthComponents", () => {
  test("is empty when both dependencies are healthy", () => {
    expect(failingHealthComponents({ main_database: true, cache_database: true })).toEqual([]);
  });

  test("names Redis when only the cache is down", () => {
    const failing = failingHealthComponents({ main_database: true, cache_database: false });

    expect(failing).toEqual(["cache_database"]);
    expect(describeHealthFailures(failing)).toMatch(/Redis unreachable.*REDIS_URL/);
  });

  test("names Postgres when only the database is down", () => {
    expect(
      describeHealthFailures(failingHealthComponents({ main_database: false, cache_database: true }))
    ).toMatch(/Postgres unreachable.*DATABASE_URL/);
  });

  test("treats a missing or malformed payload as every component down", () => {
    expect(failingHealthComponents(undefined)).toEqual(["main_database", "cache_database"]);
    expect(failingHealthComponents("ok")).toEqual(["main_database", "cache_database"]);
  });
});

describe("authFailure", () => {
  test("401 says the key is invalid", () => {
    expect(authFailure(401, "ws1").message).toMatch(/API key invalid/);
  });

  test("403 says the key lacks access to the named workspace", () => {
    expect(authFailure(403, "ws1").message).toMatch(/lacks access to workspace ws1/);
  });

  test("anything else names the management API", () => {
    expect(authFailure(502, "ws1").message).toMatch(/Management API.*502/);
  });
});
