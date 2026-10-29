import { describe, expect, test } from "vitest";
import {
  AUTH_REQUEST_MAX_JSON_ENTRIES,
  exceedsAuthJsonBounds,
  hasOversizedJsonCollection,
} from "./auth-request-json-bounds";

const MAX = AUTH_REQUEST_MAX_JSON_ENTRIES;
const items = (count: number) => Array.from({ length: count }, (_, index) => `item-${index}`);
const keys = (count: number) => Object.fromEntries(items(count).map((key) => [key, 1]));
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("hasOversizedJsonCollection", () => {
  test.each([
    ["an array at the cap", { scopes: items(MAX) }],
    ["an object at the cap", keys(MAX)],
    ["scalars", "text"],
    ["null", null],
  ])("accepts %s", (_, value) => {
    expect(hasOversizedJsonCollection(value, MAX)).toBe(false);
  });

  test.each([
    ["a top-level array one past the cap", items(MAX + 1)],
    ["an object one key past the cap", keys(MAX + 1)],
    ["an array nested in an object", { client: { redirect_uris: items(MAX + 1) } }],
    ["an object nested in an array", { jwks: { keys: [{}, keys(MAX + 1)] } }],
  ])("finds %s", (_, value) => {
    expect(hasOversizedJsonCollection(value, MAX)).toBe(true);
  });

  test("walks a deeply nested body without running out of stack", () => {
    const deep = JSON.parse("[".repeat(100_000) + "]".repeat(100_000));

    expect(hasOversizedJsonCollection(deep, MAX)).toBe(false);
  });
});

describe("exceedsAuthJsonBounds", () => {
  const oversized = bytes({ scopes: items(MAX + 1) });

  test.each(["application/json", "application/json; charset=utf-8", "application/merge-patch+json"])(
    "checks a %s body",
    (contentType) => {
      expect(exceedsAuthJsonBounds(contentType, oversized)).toBe(true);
      expect(exceedsAuthJsonBounds(contentType, bytes({ scopes: items(MAX) }))).toBe(false);
    }
  );

  // Better Auth parses only JSON content types as JSON, so these never reach a schema as an array.
  test.each([null, "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "text/plain"])(
    "leaves a %s body alone",
    (contentType) => {
      expect(exceedsAuthJsonBounds(contentType, oversized)).toBe(false);
    }
  );

  test("leaves a body that is not valid JSON to the handler", () => {
    expect(exceedsAuthJsonBounds("application/json", new TextEncoder().encode("{not json"))).toBe(false);
  });
});
