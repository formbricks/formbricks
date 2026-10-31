import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  AUTH_REQUEST_MAX_ENTRIES,
  exceedsAuthRequestBounds,
  hasOversizedJsonCollection,
  isJsonContentType,
} from "./auth-request-bounds";

const MAX = AUTH_REQUEST_MAX_ENTRIES;
const URL_BASE = "http://localhost/api/auth/oauth2/authorize";
const items = (count: number) => Array.from({ length: count }, (_, index) => `item-${index}`);
const keys = (count: number) => Object.fromEntries(items(count).map((key) => [key, 1]));
const encode = (text: string) => new TextEncoder().encode(text);
const json = (value: unknown) => encode(JSON.stringify(value));
const repeated = (key: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${key}=r${index}`).join("&");
const claims = (count: number) => `claims=${encodeURIComponent(JSON.stringify({ userinfo: keys(count) }))}`;

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

describe("exceedsAuthRequestBounds", () => {
  describe("a JSON body", () => {
    const oversized = json({ scopes: items(MAX + 1) });

    test.each([
      "application/json",
      "Application/JSON",
      "application/json; charset=utf-8",
      "application/merge-patch+json",
    ])("is checked when sent as %s", (contentType) => {
      expect(exceedsAuthRequestBounds(URL_BASE, contentType, oversized)).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, contentType, json({ scopes: items(MAX) }))).toBe(false);
    });

    // Better Auth parses none of these as JSON, so the array never reaches a schema.
    test.each([null, "multipart/form-data; boundary=x", "text/plain"])(
      "is left alone when sent as %s",
      (contentType) => {
        expect(exceedsAuthRequestBounds(URL_BASE, contentType, oversized)).toBe(false);
      }
    );

    test("that does not parse is left to the handler", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, "application/json", encode("{not json"))).toBe(false);
    });
  });

  describe("a query string", () => {
    test("with a parameter repeated past the cap is refused", () => {
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${repeated("resource", MAX + 1)}`, null, undefined)).toBe(
        true
      );
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${repeated("resource", MAX)}`, null, undefined)).toBe(
        false
      );
    });

    test("with JSON in a parameter holding an oversized collection is refused", () => {
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${claims(MAX + 1)}`, null, undefined)).toBe(true);
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${claims(MAX)}`, null, undefined)).toBe(false);
    });
  });

  describe("a form body", () => {
    const form = "application/x-www-form-urlencoded";

    test("with JSON in a field holding an oversized collection is refused", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(claims(MAX + 1)))).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(claims(MAX)))).toBe(false);
    });

    test("with a field repeated past the cap is refused", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(repeated("resource", MAX + 1)))).toBe(true);
    });

    test("with ordinary fields that only look like JSON is accepted", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode("state=%7Bnot+json&scope=openid"))).toBe(false);
    });
  });
});

/**
 * The guard decides "is this JSON" with its own copy of better-call's test, so a better-call upgrade that
 * widened the test would let an oversized body past it. A JSON array body comes out of better-call as an
 * array only when it parsed it as JSON (a form parse yields an object, anything else a string).
 */
describe("isJsonContentType, against better-call's own body parsing", async () => {
  // Resolved from better-auth, so this is the copy Better Auth actually runs, whatever version it pins.
  const { createEndpoint, createRouter } = (await import(
    createRequire(import.meta.resolve("better-auth")).resolve("better-call")
  )) as typeof import("better-call");
  const echo = createEndpoint("/echo", { method: "POST", body: z.any() }, async (ctx) =>
    ctx.json({ parsedAsJson: Array.isArray(ctx.body) })
  );
  const router = createRouter({ echo });

  test.each([
    "application/json",
    "APPLICATION/JSON",
    "application/json; charset=utf-8",
    "application/merge-patch+json",
    "application/vnd.api+json",
    "text/json",
    "text/plain",
    "application/x-www-form-urlencoded",
    "application/jsonx",
    "application/x-json",
  ])("agrees for %s", async (contentType) => {
    const response = await router.handler(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": contentType },
        body: "[1,2]",
      })
    );
    const { parsedAsJson } = (await response.json()) as { parsedAsJson: boolean };

    expect(isJsonContentType(contentType)).toBe(parsedAsJson);
  });
});
