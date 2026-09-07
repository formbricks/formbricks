import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBetterAuthRequestContext } from "@/modules/auth/lib/better-auth-request-context";
import { GET, POST } from "./route";

// Mock the BA instance + the SSO request-context wrapper so the route's delegation can be asserted
// without the real auth graph. The wrapper's own AsyncLocalStorage behavior is covered in
// sso-request-context's tests + the cutover integration check (runbook §4); here we assert the route
// runs `auth.handler` INSIDE `runWithSsoRequestContext` for both verbs.
//
// The observability context (`better-auth-request-context` + `better-auth-path-label`) is deliberately
// NOT mocked: what needs proving is that this route wires them correctly, and a mock of either would
// assert the test's own arrangement instead. `api` mirrors the shape route.ts reads the label
// vocabulary from — each endpoint function carries its declared path.
const { handlerMock, runWithCtxMock } = vi.hoisted(() => ({
  // Parameter declared even though the body ignores it: `mock.calls` is typed from the signature, so
  // without it `calls[0]` is a zero-length tuple and every `calls[0][0]` read below is a type error.
  handlerMock: vi.fn(async (_request: Request) => new Response("ok", { status: 200 })),
  runWithCtxMock: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: {
    handler: handlerMock,
    api: {
      getSession: { path: "/get-session" },
      signInEmail: { path: "/sign-in/email" },
      resetPassword: { path: "/reset-password" },
      resetPasswordCallback: { path: "/reset-password/:token" },
      // The OAuth callback Better Auth really declares (`api/routes/callback.mjs`). Present here so the
      // label vocabulary matches production: without it `callback` is not a known first segment and a
      // pinned SSO callback would label `unknown` in this suite while labelling correctly in the app.
      callbackOAuth: { path: "/callback/:id" },
      // A nullish entry, deliberately. The label vocabulary is built at MODULE LOAD from this object,
      // so `endpoint.path` on a null would throw there and take down every `/api/auth/*` request — the
      // route, not just the tag. Importing this file at all is what asserts it does not.
      nullishEndpoint: null,
    },
  },
}));
vi.mock("@/modules/ee/sso/lib/sso-request-context", () => ({
  runWithSsoRequestContext: runWithCtxMock,
}));

// NOTE on assertions below: a Request must never be asserted with `toHaveBeenCalledWith`. Request state
// lives in internal slots, so it has no own properties and ANY two Request objects compare deep-equal
// under vitest — such an assertion passes even when the handler was called with a completely different
// URL. Assert identity (`toBe`) for pass-through, and read `.url` off the recorded call for a rewrite.
describe("[...all] Better Auth route (ENG-1054 cutover)", () => {
  beforeEach(() => {
    handlerMock.mockClear();
    runWithCtxMock.mockClear();
  });

  test("GET delegates to auth.handler within the SSO request context", async () => {
    const request = new Request("http://localhost/api/auth/get-session");
    // Record ordering so we prove auth.handler runs INSIDE the wrapper (not merely that both ran) —
    // that's the cutover regression: a bare handler would make new-SSO-user sign-ups throw.
    const calls: string[] = [];
    runWithCtxMock.mockImplementationOnce(async (fn: () => unknown) => {
      calls.push("wrapper:start");
      const response = await fn();
      calls.push("wrapper:end");
      return response;
    });
    handlerMock.mockImplementationOnce(async () => {
      calls.push("handler");
      return new Response("ok", { status: 200 });
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(runWithCtxMock).toHaveBeenCalledTimes(1);
    expect(handlerMock.mock.calls[0][0]).toBe(request);
    expect(calls).toEqual(["wrapper:start", "handler", "wrapper:end"]);
  });

  test("POST delegates to auth.handler within the SSO request context", async () => {
    const request = new Request("http://localhost/api/auth/sign-in/email", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(runWithCtxMock).toHaveBeenCalledTimes(1);
    expect(handlerMock.mock.calls[0][0]).toBe(request);
  });

  test("GET and POST share the single wrapped handler", () => {
    expect(GET).toBe(POST);
  });
});

// ENG-2259: the Sentry capture in better-auth-observability.ts reads this context, so if the route
// stops opening it the fault reports with no endpoint again — exactly the state that left
// FORMBRICKS-183 untriageable at ~242 events.
describe("[...all] Better Auth route — observability context (ENG-2259)", () => {
  beforeEach(() => {
    handlerMock.mockClear();
    runWithCtxMock.mockClear();
  });

  const captureContextDuringHandler = async (request: Request) => {
    let seen: ReturnType<typeof getBetterAuthRequestContext>;
    handlerMock.mockImplementationOnce(async () => {
      seen = getBetterAuthRequestContext();
      return new Response("ok", { status: 200 });
    });
    await POST(request);
    return seen;
  };

  test("exposes the endpoint label and method to the handler", async () => {
    const seen = await captureContextDuringHandler(
      new Request("http://localhost/api/auth/sign-in/email", { method: "POST" })
    );

    expect(seen).toEqual({ path: "/sign-in/email", method: "POST" });
  });

  test("never exposes the token from /reset-password/:token", async () => {
    const token = "faketokenfaketokenfaketoken00001";

    const seen = await captureContextDuringHandler(
      new Request(`http://localhost/api/auth/reset-password/${token}`, { method: "POST" })
    );

    // The endpoint is still identified; the credential in its path is not carried anywhere.
    expect(seen).toEqual({ path: "/reset-password/*", method: "POST" });
    expect(JSON.stringify(seen)).not.toContain(token);
  });

  // The label is derived from the MAPPED request, so a pinned SSO callback reports the endpoint that
  // actually ran. Labelling the raw URL would file it under `/oauth2/*` — the MCP OAuth
  // authorization-server facet — which is the one bucket it must never be confused with (ENG-2343).
  test("labels a pinned SSO callback as the endpoint that ran, not as MCP OAuth", async () => {
    const seen = await captureContextDuringHandler(
      new Request("http://localhost/api/auth/oauth2/callback/openid?code=abc&state=xyz", {
        method: "POST",
      })
    );

    expect(seen).toEqual({ path: "/callback/*", method: "POST" });
  });
});

/**
 * The pinned SSO callback URL (ENG-2343). `redirectURI` makes Better Auth advertise
 * `/api/auth/oauth2/callback/{providerId}` — the URL customer IdPs have had registered since v5.2 — but no
 * 1.7 route is mounted there, so this route is what serves it. The mapper itself is covered exhaustively in
 * legacy-sso-callback.test.ts; what needs proving *here* is that the route actually applies it, because the
 * two delegation tests above pass either way: the mapper returns the identical request object on every
 * non-pinned path, so they would still be green with the call deleted.
 */
describe("[...all] Better Auth route — pinned SSO callback (ENG-2343)", () => {
  beforeEach(() => {
    handlerMock.mockClear();
    runWithCtxMock.mockClear();
  });

  test("hands Better Auth the current callback path, preserving code and state", async () => {
    await GET(new Request("http://localhost/api/auth/oauth2/callback/openid?code=abc&state=xyz"));

    expect(handlerMock).toHaveBeenCalledTimes(1);
    const handled = handlerMock.mock.calls[0][0];
    expect(handled.url).toBe("http://localhost/api/auth/callback/openid?code=abc&state=xyz");
  });

  test("still maps inside the SSO request context", async () => {
    const calls: string[] = [];
    runWithCtxMock.mockImplementationOnce(async (fn: () => unknown) => {
      calls.push("wrapper:start");
      const response = await fn();
      calls.push("wrapper:end");
      return response;
    });
    handlerMock.mockImplementationOnce(async () => {
      calls.push("handler");
      return new Response("ok", { status: 200 });
    });

    await GET(new Request("http://localhost/api/auth/oauth2/callback/saml?code=abc"));

    expect(calls).toEqual(["wrapper:start", "handler", "wrapper:end"]);
    // Without this the test is a duplicate of the ordering test above: it would stay green with the
    // mapper call deleted, since ordering does not depend on it.
    expect(handlerMock.mock.calls[0][0].url).toBe("http://localhost/api/auth/callback/saml?code=abc");
  });

  // The sibling routes of our own MCP OAuth authorization server must pass through untouched — the same
  // object, not a rebuilt equivalent.
  test("leaves a sibling MCP OAuth route untouched", async () => {
    const request = new Request("http://localhost/api/auth/oauth2/userinfo");

    await GET(request);

    expect(handlerMock.mock.calls[0][0]).toBe(request);
  });
});
