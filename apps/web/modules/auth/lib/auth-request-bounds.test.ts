import { createRequire } from "node:module";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  AUTH_REQUEST_MAX_ENTRIES,
  AUTH_REQUEST_MAX_JSON_TEXTS,
  exceedsAuthRequestBounds,
  hasOversizedJsonCollection,
  isFormContentType,
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
const distinct = (count: number) => Array.from({ length: count }, (_, index) => `p${index}=x`).join("&");
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
  // Strings a Better Auth plugin reads as a collection of its own, wherever the request carries them.
  describe("named values", () => {
    const fields = (count: number) => Array.from({ length: count }, (_, index) => `f${index}=1`).join("&");
    const words = (count: number) => Array.from({ length: count }, (_, index) => `s${index}`).join(" ");
    const carriers = (name: string, value: string) => ({
      "a JSON body": [URL_BASE, "application/json", json({ [name]: value })] as const,
      "a form body": [
        URL_BASE,
        "application/x-www-form-urlencoded",
        encode(new URLSearchParams({ [name]: value }).toString()),
      ] as const,
      "the query": [
        `${URL_BASE}?${new URLSearchParams({ [name]: value }).toString()}`,
        null,
        undefined,
      ] as const,
    });

    test.each([
      ["oauth_query", fields],
      ["scope", words],
      ["prompt", words],
    ])("%s is refused past the cap in a JSON body, a form body or the query", (name, build) => {
      for (const [carrier, args] of Object.entries(carriers(name, build(MAX + 1)))) {
        expect(exceedsAuthRequestBounds(...args), carrier).toBe(true);
      }
      for (const [carrier, args] of Object.entries(carriers(name, build(MAX)))) {
        expect(exceedsAuthRequestBounds(...args), carrier).toBe(false);
      }
    });

    test("a scope list of empty items counts each one, as split(' ') does", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, "application/json", json({ scope: " ".repeat(MAX) }))).toBe(
        true
      );
    });
  });

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

    // The consent endpoint takes `claims` as a string in a JSON body and parses it itself.
    test("with JSON text in a string field holding an oversized collection is refused", () => {
      const consent = (count: number) =>
        json({ accept: true, claims: JSON.stringify({ userinfo: keys(count) }) });

      expect(exceedsAuthRequestBounds(URL_BASE, "application/json", consent(MAX + 1))).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, "application/json", consent(MAX))).toBe(false);
      expect(
        exceedsAuthRequestBounds(URL_BASE, "application/json", json({ password: `{${"x".repeat(500)}` }))
      ).toBe(false);
    });

    // Each list stays within the entry cap; what grows is how many strings the guard would parse.
    describe("with many strings that look like JSON", () => {
      const wide = (text: string) =>
        json(Array.from({ length: MAX }, () => Array.from({ length: MAX }, () => text)));

      test("parses none that only start like JSON", () => {
        const parse = vi.spyOn(JSON, "parse");

        expect(exceedsAuthRequestBounds(URL_BASE, "application/json", wide("["))).toBe(false);
        expect(parse).toHaveBeenCalledTimes(1);
        parse.mockRestore();
      });

      test("refuses once the JSON-text budget is spent, without parsing the rest", () => {
        const parse = vi.spyOn(JSON, "parse");

        expect(exceedsAuthRequestBounds(URL_BASE, "application/json", wide("[]"))).toBe(true);
        expect(parse).toHaveBeenCalledTimes(1 + AUTH_REQUEST_MAX_JSON_TEXTS);
        parse.mockRestore();
      });

      test("accepts as many JSON texts as the budget holds", () => {
        const texts = Array.from({ length: AUTH_REQUEST_MAX_JSON_TEXTS }, () => "[]");

        expect(exceedsAuthRequestBounds(URL_BASE, "application/json", json({ texts }))).toBe(false);
        expect(
          exceedsAuthRequestBounds(URL_BASE, "application/json", json({ texts: [...texts, "[]"] }))
        ).toBe(true);
      });
    });

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

    // The whole query is one map to the handler, so distinct names count as much as repeats.
    test("with more distinct parameters than the cap is refused", () => {
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${distinct(MAX + 1)}`, null, undefined)).toBe(true);
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${distinct(MAX)}`, null, undefined)).toBe(false);
    });

    test("with JSON in a parameter holding an oversized collection is refused", () => {
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${claims(MAX + 1)}`, null, undefined)).toBe(true);
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${claims(MAX)}`, null, undefined)).toBe(false);
    });
  });

  describe("a form body", () => {
    const form = "application/x-www-form-urlencoded";

    // URLSearchParams slows down sharply on fields with no value, so an over-long body is refused on the
    // count alone, before one is built.
    test("with more fields than the cap is refused without parsing it", () => {
      const built: unknown[] = [];
      vi.stubGlobal(
        "URLSearchParams",
        class extends URLSearchParams {
          constructor(init?: string) {
            super(init);
            built.push(init);
          }
        }
      );
      try {
        expect(exceedsAuthRequestBounds(URL_BASE, form, encode("a&".repeat(100_000)))).toBe(true);
        expect(built.filter((init) => typeof init === "string" && init.length > 1_000)).toEqual([]);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    test("with empty fields is counted the way URLSearchParams reads it", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(`${distinct(MAX)}${"&".repeat(1_000)}`))).toBe(
        false
      );
    });

    test("with JSON in a field holding an oversized collection is refused", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(claims(MAX + 1)))).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(claims(MAX)))).toBe(false);
    });

    test("with a field repeated past the cap is refused", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(repeated("resource", MAX + 1)))).toBe(true);
    });

    test("with more distinct fields than the cap is refused", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(distinct(MAX + 1)))).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(distinct(MAX)))).toBe(false);
    });

    // `+` decodes to a space, and JSON.parse skips leading whitespace, so a padded value parses too.
    test.each([
      ["a space", "+"],
      ["a tab", "%09"],
      ["a newline", "%0A"],
    ])("with JSON padded by %s holding an oversized collection is refused", (_, padding) => {
      const padded = (count: number) => claims(count).replace("claims=", `claims=${padding}`);

      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(padded(MAX + 1)))).toBe(true);
      expect(exceedsAuthRequestBounds(`${URL_BASE}?${padded(MAX + 1)}`, null, undefined)).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(padded(MAX)))).toBe(false);
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
// The slice of better-call these tests drive. Typed here rather than imported: apps/web does not depend on
// better-call itself, and the copy under test is the one better-auth resolves, whatever version it pins.
type TBetterCall = {
  createEndpoint: (
    path: string,
    options: Record<string, unknown>,
    handler: (ctx: { body: unknown; json: (value: unknown) => unknown }) => Promise<unknown>
  ) => unknown;
  createRouter: (endpoints: Record<string, unknown>) => { handler: (request: Request) => Promise<Response> };
};

const loadBetterCall = async () =>
  (await import(createRequire(import.meta.resolve("better-auth")).resolve("better-call"))) as TBetterCall;

describe("isJsonContentType, against better-call's own body parsing", async () => {
  const { createEndpoint, createRouter } = await loadBetterCall();
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

/**
 * The same check for form bodies: the guard counts a form's fields exactly when better-call would parse
 * the body as one. The echo endpoint allows the media types Better Auth's form endpoints allow.
 */
describe("isFormContentType, against better-call's own body parsing", async () => {
  const { createEndpoint, createRouter } = await loadBetterCall();
  const echo = createEndpoint(
    "/echo",
    {
      method: "POST",
      body: z.any(),
      metadata: { allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"] },
    },
    async (ctx) => ctx.json({ parsedAsForm: (ctx.body as Record<string, unknown> | undefined)?.a === "1" })
  );
  const router = createRouter({ echo });

  test.each([
    "application/x-www-form-urlencoded",
    "APPLICATION/X-WWW-FORM-URLENCODED; charset=utf-8",
    "application/x-www-form-urlencodedx",
    'multipart/form-data; boundary=x; p="application/x-www-form-urlencoded"',
    'text/plain; p="application/x-www-form-urlencoded"',
    "application/json",
  ])("agrees for %s", async (contentType) => {
    const response = await router.handler(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": contentType },
        body: "a=1",
      })
    );
    // A body better-call refuses, or fails to read, answers without the echo.
    const text = await response.text();
    const { parsedAsForm = false } = (response.ok ? JSON.parse(text) : {}) as { parsedAsForm?: boolean };

    expect(isFormContentType(contentType)).toBe(parsedAsForm);
  });
});
