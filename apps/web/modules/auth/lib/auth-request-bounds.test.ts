import { createRequire } from "node:module";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  AUTH_REQUEST_MAX_DEPTH,
  AUTH_REQUEST_MAX_ENTRIES,
  AUTH_REQUEST_MAX_JSON_TEXTS,
  OAUTH_QUERY_MAX_FIELDS,
  authBodyKindOf,
  exceedsAuthRequestBounds,
  hasOversizedJsonCollection,
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

  test("refuses nesting one level past the cap, and a far deeper body without running out of stack", () => {
    const nested = (levels: number) => JSON.parse("[".repeat(levels) + "]".repeat(levels));

    expect(hasOversizedJsonCollection(nested(AUTH_REQUEST_MAX_DEPTH), MAX)).toBe(false);
    expect(hasOversizedJsonCollection(nested(AUTH_REQUEST_MAX_DEPTH + 1), MAX)).toBe(true);
    expect(hasOversizedJsonCollection(nested(100_000), MAX)).toBe(true);
  });
});

describe("exceedsAuthRequestBounds", () => {
  // Strings a Better Auth plugin reads as a collection of its own, wherever the request carries them.
  describe("named values", () => {
    const fields = (count: number) => Array.from({ length: count }, (_, index) => `f${index}=1`).join("&");
    const words = (count: number) => Array.from({ length: count }, (_, index) => `s${index}`).join(" ");
    type TCarrier = [label: string, url: string, kind: "json" | "form" | null, body: Uint8Array | undefined];
    const carriers = (name: string, value: string): TCarrier[] => {
      const encoded = new URLSearchParams({ [name]: value }).toString();
      return [
        ["a JSON body", URL_BASE, "json", json({ [name]: value })],
        ["a form body", URL_BASE, "form", encode(encoded)],
        ["the query", `${URL_BASE}?${encoded}`, null, undefined],
      ];
    };

    test.each([
      ["oauth_query", fields, OAUTH_QUERY_MAX_FIELDS],
      ["scope", words, MAX],
      ["prompt", words, MAX],
    ])("%s is refused past its cap in a JSON body, a form body or the query", (name, build, cap) => {
      for (const [carrier, url, kind, body] of carriers(name, build(cap + 1))) {
        expect(exceedsAuthRequestBounds(url, kind, body), carrier).toBe(true);
      }
      for (const [carrier, url, kind, body] of carriers(name, build(cap))) {
        expect(exceedsAuthRequestBounds(url, kind, body), carrier).toBe(false);
      }
    });

    // oauth-provider signs the authorize request it sends to the login and consent pages: each parameter,
    // a `ba_param` naming it, and `exp`, `ba_iat`, `sig` and `ba_pl` with their own `ba_param` entries.
    test("a signed oauth_query for an authorize request at the cap still passes", () => {
      const names = [
        ...Array.from({ length: MAX }, (_, index) => `p${index}`),
        "exp",
        "ba_iat",
        "sig",
        "ba_pl",
      ];
      const signed = [
        ...names.map((name) => `${name}=v`),
        ...names.filter((name) => name !== "sig").map((name) => `ba_param=${name}`),
        "ba_param=ba_param",
      ].join("&");

      expect(exceedsAuthRequestBounds(`${URL_BASE}?${distinct(MAX)}`, null, undefined)).toBe(false);
      expect(exceedsAuthRequestBounds(URL_BASE, "json", json({ oauth_query: signed }))).toBe(false);
    });

    test("a scope list of empty items counts each one, as split(' ') does", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, "json", json({ scope: " ".repeat(MAX) }))).toBe(true);
    });
  });

  describe("a JSON body", () => {
    const oversized = json({ scopes: items(MAX + 1) });

    test("is checked", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, "json", oversized)).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, "json", json({ scopes: items(MAX) }))).toBe(false);
    });

    // The consent endpoint takes `claims` as a string in a JSON body and parses it itself.
    test("with JSON text in a string field holding an oversized collection is refused", () => {
      const consent = (count: number) =>
        json({ accept: true, claims: JSON.stringify({ userinfo: keys(count) }) });

      expect(exceedsAuthRequestBounds(URL_BASE, "json", consent(MAX + 1))).toBe(true);
      expect(exceedsAuthRequestBounds(URL_BASE, "json", consent(MAX))).toBe(false);
      expect(exceedsAuthRequestBounds(URL_BASE, "json", json({ password: `{${"x".repeat(500)}` }))).toBe(
        false
      );
    });

    // Each list stays within the entry cap; what grows is how many strings the guard would parse.
    describe("with many strings that look like JSON", () => {
      const wide = (text: string) =>
        json(Array.from({ length: MAX }, () => Array.from({ length: MAX }, () => text)));

      test("parses none that only start like JSON", () => {
        const parse = vi.spyOn(JSON, "parse");

        expect(exceedsAuthRequestBounds(URL_BASE, "json", wide("["))).toBe(false);
        expect(parse).toHaveBeenCalledTimes(1);
        parse.mockRestore();
      });

      test("refuses once the JSON-text budget is spent, without parsing the rest", () => {
        const parse = vi.spyOn(JSON, "parse");

        expect(exceedsAuthRequestBounds(URL_BASE, "json", wide("[]"))).toBe(true);
        expect(parse).toHaveBeenCalledTimes(1 + AUTH_REQUEST_MAX_JSON_TEXTS);
        parse.mockRestore();
      });

      test("accepts as many JSON texts as the budget holds", () => {
        const texts = Array.from({ length: AUTH_REQUEST_MAX_JSON_TEXTS }, () => "[]");

        expect(exceedsAuthRequestBounds(URL_BASE, "json", json({ texts }))).toBe(false);
        expect(exceedsAuthRequestBounds(URL_BASE, "json", json({ texts: [...texts, "[]"] }))).toBe(true);
      });
    });

    test("that does not parse is left to the handler", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, "json", encode("{not json"))).toBe(false);
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
    const form = "form";

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

    // URLSearchParams skips empty fields, so they don't count toward the cap, but a body made of them is
    // still refused once it holds more than four times the cap.
    test("with empty fields is counted the way URLSearchParams reads it, up to a limit", () => {
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode(`${distinct(MAX)}${"&".repeat(MAX)}`))).toBe(
        false
      );
      expect(exceedsAuthRequestBounds(URL_BASE, form, encode("&".repeat(4 * MAX)))).toBe(true);
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

describe("authBodyKindOf", () => {
  test.each([
    ["application/json", "json"],
    ["Application/JSON", "json"],
    ["application/json; charset=utf-8", "json"],
    ["application/json;charset=UTF-8", "json"],
    ['application/json; charset="utf-8"', "json"],
    // Every consumer decodes UTF-8 whatever the charset says, so another one reads the same way.
    ["application/json; charset=latin1", "json"],
    ["application/x-www-form-urlencoded; charset=ISO-8859-1", "form"],
    ["application/x-www-form-urlencoded", "form"],
    ["application/x-www-form-urlencoded; charset=UTF-8", "form"],
  ])("reads %s as %s", (contentType, kind) => {
    expect(authBodyKindOf(contentType)).toBe(kind);
  });

  // Each of these is read one way by better-call and another by oauth-provider, or by neither, so the
  // routes refuse it before either sees it.
  test.each([
    null,
    "",
    "text/plain",
    "multipart/form-data; boundary=x",
    "application/merge-patch+json",
    "application/x-www-form-urlencoded+json",
    "application/jsonapplication/x-www-form-urlencoded",
    "application/x-www-form-urlencodedx",
    "multipart/form-data/application/x-www-form-urlencoded",
    'application/json; p="application/x-www-form-urlencoded"',
    "application/json; charset=x-www-form-urlencoded",
    'application/json; charset="x-www-form-urlencoded"',
    "application/json; charset=utf-8; boundary=x",
    "text/plain, application/x-www-form-urlencoded",
    "application/x-www-form-urlencoded; a=b, multipart/form-data; boundary=x",
  ])("refuses %s", (contentType) => {
    expect(authBodyKindOf(contentType)).toBeNull();
  });
});

/**
 * Every content type the guard accepts must be read the same way by everything downstream: better-call,
 * which parses the body, and oauth-provider, which re-reads any body whose header contains the form type
 * as a form. A better-call upgrade that changed its parsing would fail here, not in production.
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

const ACCEPTED = [
  "application/json",
  "APPLICATION/JSON; charset=utf-8",
  'application/json; charset="UTF-8"',
  "application/x-www-form-urlencoded",
  "application/x-www-form-urlencoded;charset=UTF-8",
  "application/json; charset=latin1",
  "application/x-www-form-urlencoded; charset=ISO-8859-1",
];

describe("accepted content types, against what reads them downstream", async () => {
  const { createEndpoint, createRouter } = await loadBetterCall();
  const echo = createEndpoint(
    "/echo",
    {
      method: "POST",
      body: z.any(),
      metadata: { allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"] },
    },
    async (ctx) =>
      ctx.json({
        parsedAsJson: Array.isArray(ctx.body),
        parsedAsForm: (ctx.body as Record<string, unknown> | undefined)?.a === "1",
      })
  );
  const router = createRouter({ echo });
  const read = async (contentType: string, body: string) => {
    const response = await router.handler(
      new Request("http://localhost/echo", { method: "POST", headers: { "content-type": contentType }, body })
    );
    // A body better-call refuses (form text sent as JSON is invalid JSON) answers without the echo.
    const echoed = response.ok ? ((await response.json()) as Partial<Record<string, boolean>>) : {};
    return { parsedAsJson: echoed.parsedAsJson ?? false, parsedAsForm: echoed.parsedAsForm ?? false };
  };

  test.each(ACCEPTED)("better-call reads %s the way the guard does", async (contentType) => {
    const kind = authBodyKindOf(contentType);

    expect((await read(contentType, "[1,2]")).parsedAsJson).toBe(kind === "json");
    expect((await read(contentType, "a=1")).parsedAsForm).toBe(kind === "form");
  });

  // oauth-provider's own test (introspect and token handlers): `content-type.includes(form type)`.
  test.each(ACCEPTED)("oauth-provider reads %s the way the guard does", (contentType) => {
    const readAsForm = contentType.toLowerCase().includes("application/x-www-form-urlencoded");

    expect(readAsForm).toBe(authBodyKindOf(contentType) === "form");
  });
});

/**
 * The named values the guard special-cases are oauth-provider's. If an upgrade renamed one, the guard would
 * silently stop covering it, so pin that the installed oauth-provider still reads them.
 */
describe("oauth-provider still reads the named values the guard caps", () => {
  test("its before-hook matches on `oauth_query` in the body", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const require = createRequire(import.meta.resolve("better-auth"));
    const dist = dirname(require.resolve("@better-auth/oauth-provider"));
    const source = readdirSync(dist)
      .filter((file) => file.endsWith(".mjs"))
      .map((file) => readFileSync(join(dist, file), "utf8"))
      .join("\n");

    expect(source).toContain("ctx.body?.oauth_query");
  });
});
