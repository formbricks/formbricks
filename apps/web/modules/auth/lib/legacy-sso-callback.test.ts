import { describe, expect, test } from "vitest";
import {
  PINNED_SSO_PROVIDER_IDS,
  mapLegacySsoCallbackRequest,
  mapLegacySsoCallbackUrl,
} from "./legacy-sso-callback";

const BASE = "https://app.formbricks.test";

describe("mapLegacySsoCallbackUrl (ENG-2343)", () => {
  test.each(PINNED_SSO_PROVIDER_IDS)("maps the pinned legacy callback for %s", (providerId) => {
    expect(mapLegacySsoCallbackUrl(`${BASE}/api/auth/oauth2/callback/${providerId}`)).toBe(
      `${BASE}/api/auth/callback/${providerId}`
    );
  });

  // The query is the whole point of a callback — dropping it would strip `code`/`state` and turn every
  // SSO sign-in into a silent failure that looks like an IdP problem.
  test("carries the authorization code and state across untouched", () => {
    const mapped = mapLegacySsoCallbackUrl(
      `${BASE}/api/auth/oauth2/callback/openid?code=abc%2F123&state=xyz&iss=${encodeURIComponent(BASE)}`
    );

    const url = new URL(mapped ?? "");
    expect(url.pathname).toBe("/api/auth/callback/openid");
    expect(url.searchParams.get("code")).toBe("abc/123");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("iss")).toBe(BASE);
  });

  // A Next.js basePath deployment serves the app from a subpath, so the auth segment is not at the root
  // of the pathname. Same reasoning as better-auth-path-label.ts (see ENG-606).
  test("resolves under a basePath deployment", () => {
    expect(mapLegacySsoCallbackUrl(`${BASE}/custom-path/api/auth/oauth2/callback/saml`)).toBe(
      `${BASE}/custom-path/api/auth/callback/saml`
    );
  });

  // The crafted-prefix guard must not also reject a legitimate basePath that merely STARTS with the auth
  // path — matching on `/api/auth` without the trailing slash would 404 SSO on such a deployment.
  test("resolves under a basePath that starts with the auth path", () => {
    expect(mapLegacySsoCallbackUrl(`${BASE}/api/authority/api/auth/oauth2/callback/openid`)).toBe(
      `${BASE}/api/authority/api/auth/callback/openid`
    );
  });

  /**
   * The scoping that makes this safe to run in the `/api/auth/*` catch-all. The oauth-provider plugin
   * owns roughly fifteen sibling `/oauth2/*` routes for our own MCP OAuth server; an unscoped prefix
   * rewrite would shadow whichever one upstream adds next. Everything not an exact pinned provider id
   * must pass through untouched.
   */
  test.each([
    ["a sibling MCP OAuth route", `${BASE}/api/auth/oauth2/userinfo`],
    ["the MCP consent route", `${BASE}/api/auth/oauth2/consent`],
    ["the current-version callback", `${BASE}/api/auth/callback/openid`],
    ["an unpinned provider id", `${BASE}/api/auth/oauth2/callback/google`],
    ["a deeper path under a pinned id", `${BASE}/api/auth/oauth2/callback/openid/extra`],
    // Rejected here as defence in depth only: Next.js 308-normalises a trailing slash (and doubled
    // slashes) to the canonical path before the route handler runs, so in production this shape reaches
    // the mapper already canonicalised and IS mapped. Verified against a running dev server.
    ["a trailing slash", `${BASE}/api/auth/oauth2/callback/openid/`],
    // Keeps the basePath tolerance from accepting a crafted double auth segment, so the only path this
    // function can emit is `<basePath>/api/auth/callback/<pinned-id>`.
    ["a second auth segment in the prefix", `${BASE}/api/auth/x/api/auth/oauth2/callback/openid`],
    ["no provider id at all", `${BASE}/api/auth/oauth2/callback/`],
    ["an unrelated endpoint", `${BASE}/api/auth/sign-in/email`],
    ["a non-auth route", `${BASE}/api/v3/surveys`],
    ["a percent-encoded provider id", `${BASE}/api/auth/oauth2/callback/openi%64`],
    ["percent-encoded separators", `${BASE}/api/auth/oauth2%2fcallback%2fopenid`],
    ["an upper-cased path", `${BASE}/api/auth/OAUTH2/CALLBACK/OPENID`],
    ["an unparseable url", "not-a-url"],
    // A cannot-be-a-base URL: the `pathname` setter is a no-op there, so without the protocol guard
    // this would come back unchanged yet non-null — a non-rewrite reported as a rewrite.
    ["an opaque, cannot-be-a-base url", "data:text/plain,/api/auth/oauth2/callback/openid"],
  ])("leaves %s alone", (_label, url) => {
    expect(mapLegacySsoCallbackUrl(url)).toBeNull();
  });
});

describe("mapLegacySsoCallbackUrl — normalisation order (ENG-2343)", () => {
  // `new URL()` resolves dot segments at construction, so matching runs on the normalised path. That is
  // the safe order: a traversal cannot be smuggled past the match, it just canonicalises into it.
  test.each([
    `${BASE}/api/auth/oauth2/callback/../callback/openid`,
    `${BASE}/api/auth/oauth2/callback/x/../openid`,
  ])("normalises dot segments before matching: %s", (url) => {
    expect(mapLegacySsoCallbackUrl(url)).toBe(`${BASE}/api/auth/callback/openid`);
  });
});

describe("mapLegacySsoCallbackRequest (ENG-2343)", () => {
  test("rewrites a GET callback and preserves method and headers", () => {
    const request = new Request(`${BASE}/api/auth/oauth2/callback/azuread?code=abc`, {
      headers: { cookie: "better-auth.state=s" },
    });

    const mapped = mapLegacySsoCallbackRequest(request);

    expect(mapped.url).toBe(`${BASE}/api/auth/callback/azuread?code=abc`);
    expect(mapped.method).toBe("GET");
    // Carrying the cookie is load-bearing: Better Auth reads the state/PKCE cookie on the callback, so
    // dropping it would fail the sign-in as a state mismatch.
    expect(mapped.headers.get("cookie")).toBe("better-auth.state=s");
  });

  // An IdP configured for `response_mode=form_post` returns the code as a POST body.
  test("forwards a POST body for a form_post response mode", async () => {
    const request = new Request(`${BASE}/api/auth/oauth2/callback/azuread`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "code=abc&state=xyz",
    });

    const mapped = mapLegacySsoCallbackRequest(request);

    expect(mapped.url).toBe(`${BASE}/api/auth/callback/azuread`);
    expect(mapped.method).toBe("POST");
    await expect(mapped.text()).resolves.toBe("code=abc&state=xyz");
  });

  // Rebuilding a Request drops everything not copied. Behavioural rather than identity-based: the spec
  // lets an implementation wrap the passed signal rather than reuse the object.
  test("carries the abort signal so a client disconnect still cancels the handler", () => {
    const controller = new AbortController();
    const request = new Request(`${BASE}/api/auth/oauth2/callback/openid?code=abc`, {
      signal: controller.signal,
    });

    const mapped = mapLegacySsoCallbackRequest(request);

    expect(mapped.signal.aborted).toBe(false);
    controller.abort();
    expect(mapped.signal.aborted).toBe(true);
  });

  test("returns the original request untouched when the path is not a pinned callback", () => {
    const request = new Request(`${BASE}/api/auth/sign-in/email`, { method: "POST" });

    expect(mapLegacySsoCallbackRequest(request)).toBe(request);
  });
});
