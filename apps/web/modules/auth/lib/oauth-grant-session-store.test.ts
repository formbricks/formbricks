import { describe, expect, test } from "vitest";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { oauthGrantReadsSessionStoreBeforeHandler } from "./oauth-grant-session-store";

const CACHE_COOKIE = "better-auth.session_data";
const TOKEN_COOKIE = "better-auth.session_token=abc.sig";

const contextFor = (path: string, cookie: string | null, cacheCookieName = CACHE_COOKIE) => {
  const headers = new Headers(cookie === null ? {} : { cookie });
  const ctx = {
    path,
    headers,
    context: { authCookies: { sessionData: { name: cacheCookieName } } },
  } as unknown as AuthHookContext;
  return { ctx, headers };
};

describe("oauthGrantReadsSessionStoreBeforeHandler", () => {
  test.each(["/oauth2/authorize", "/oauth2/consent", "/oauth2/continue"])(
    "drops the session cache cookie on %s and keeps the session token",
    (path) => {
      const { ctx, headers } = contextFor(path, `${TOKEN_COOKIE}; ${CACHE_COOKIE}=eyJ.payload; theme=dark`);

      oauthGrantReadsSessionStoreBeforeHandler(ctx);

      expect(headers.get("cookie")).toBe(`${TOKEN_COOKIE}; theme=dark`);
    }
  );

  test("drops every chunk of a split cache cookie, and nothing that only shares its prefix", () => {
    const { ctx, headers } = contextFor(
      "/oauth2/authorize",
      `${TOKEN_COOKIE}; ${CACHE_COOKIE}.0=aaa; ${CACHE_COOKIE}.1=bbb; ${CACHE_COOKIE}_other=keep; ${CACHE_COOKIE}.x=keep`
    );

    oauthGrantReadsSessionStoreBeforeHandler(ctx);

    expect(headers.get("cookie")).toBe(`${TOKEN_COOKIE}; ${CACHE_COOKIE}_other=keep; ${CACHE_COOKIE}.x=keep`);
  });

  test("uses the configured cookie name, which carries the __Secure- prefix over https", () => {
    const name = "__Secure-better-auth.session_data";
    const { ctx, headers } = contextFor(
      "/oauth2/consent",
      `__Secure-better-auth.session_token=abc; ${name}=eyJ; ${CACHE_COOKIE}=plain`,
      name
    );

    oauthGrantReadsSessionStoreBeforeHandler(ctx);

    expect(headers.get("cookie")).toBe(`__Secure-better-auth.session_token=abc; ${CACHE_COOKIE}=plain`);
  });

  test.each([
    "/get-session",
    "/oauth2/token",
    "/oauth2/get-consents",
    "/sign-in/email",
    "/oauth2/authorize/x",
  ])("leaves %s on the cookie cache", (path) => {
    const cookie = `${TOKEN_COOKIE}; ${CACHE_COOKIE}=eyJ.payload`;
    const { ctx, headers } = contextFor(path, cookie);

    oauthGrantReadsSessionStoreBeforeHandler(ctx);

    expect(headers.get("cookie")).toBe(cookie);
  });

  test("does nothing without a cookie header or without a cache cookie", () => {
    const withoutHeader = contextFor("/oauth2/authorize", null);
    oauthGrantReadsSessionStoreBeforeHandler(withoutHeader.ctx);
    expect(withoutHeader.headers.has("cookie")).toBe(false);

    const withoutCache = contextFor("/oauth2/authorize", TOKEN_COOKIE);
    oauthGrantReadsSessionStoreBeforeHandler(withoutCache.ctx);
    expect(withoutCache.headers.get("cookie")).toBe(TOKEN_COOKIE);
  });

  test.each([
    ["a space before the =", `${CACHE_COOKIE} =jwt`],
    ["a tab before the =", `${CACHE_COOKIE}\t=jwt`],
    ["a non-breaking space before the =", `${CACHE_COOKIE}\u00a0=jwt`],
    ["a chunk with a space before the =", `${CACHE_COOKIE}.0 =jwt`],
    ["no space after the ;", `theme=dark;${CACHE_COOKIE}=jwt`],
  ])("drops the cache cookie with %s, as the readers would parse it", (_label, cacheCookie) => {
    const { ctx, headers } = contextFor("/oauth2/consent", `${TOKEN_COOKIE}; ${cacheCookie}`);

    oauthGrantReadsSessionStoreBeforeHandler(ctx);

    expect(headers.get("cookie")).not.toContain("jwt");
    expect(headers.get("cookie")).toContain("session_token=abc.sig");
  });

  test("refuses a request that carries the cache cookie only on `request`, where it cannot be edited", () => {
    const ctx = {
      path: "/oauth2/authorize",
      headers: undefined,
      request: new Request("http://localhost:3000/api/auth/oauth2/authorize", {
        headers: { cookie: `${TOKEN_COOKIE}; ${CACHE_COOKIE}=jwt` },
      }),
      context: { authCookies: { sessionData: { name: CACHE_COOKIE } } },
    } as unknown as AuthHookContext;

    expect(() => oauthGrantReadsSessionStoreBeforeHandler(ctx)).toThrow(/not accepted/);
  });

  test("lets a request-only call without a cache cookie through", () => {
    const ctx = {
      path: "/oauth2/authorize",
      headers: undefined,
      request: new Request("http://localhost:3000/api/auth/oauth2/authorize", {
        headers: { cookie: TOKEN_COOKIE },
      }),
      context: { authCookies: { sessionData: { name: CACHE_COOKIE } } },
    } as unknown as AuthHookContext;

    expect(() => oauthGrantReadsSessionStoreBeforeHandler(ctx)).not.toThrow();
  });

  test("does nothing when the request carries no headers object", () => {
    const ctx = {
      path: "/oauth2/authorize",
      headers: undefined,
      context: { authCookies: { sessionData: { name: CACHE_COOKIE } } },
    } as unknown as AuthHookContext;

    expect(() => oauthGrantReadsSessionStoreBeforeHandler(ctx)).not.toThrow();
  });
});
