import * as Sentry from "@sentry/nextjs";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { auth } from "@/modules/auth/lib/auth";
import { createAuthPathLabeller } from "@/modules/auth/lib/better-auth-path-label";

/**
 * ENG-2259 / FORMBRICKS-183 — the endpoint label must survive the real Better Auth request.
 *
 * This has to be an integration test. The question is whether the AsyncLocalStorage store opened by
 * the route is still readable by the time better-call's router catches an unexpected throw and calls
 * our logger — a chain that lives entirely inside `auth.handler`. A unit test with a mocked handler
 * asserts its own arrangement; only the real router can answer it.
 *
 * Kept in its own file rather than folded into better-auth-observability.integration.test.ts so the
 * IS_PRODUCTION override below cannot perturb that file's audit assertions.
 */

// betterAuthLogger only captures when SENTRY_DSN && IS_PRODUCTION; force both on for this file.
vi.mock("@/lib/constants", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/constants")>()),
  IS_PRODUCTION: true,
  SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// Fault injection: `ssoLicenseGateBeforeHandler` is the first thing hooks.before awaits and it runs on
// every request, so throwing here produces a genuine non-APIError inside the router on whatever path
// we drive — the same shape as the production fault (a TypeError from an awaited async auth path).
// Spread the real module so ssoDatabaseHooks and the rest of auth.ts's wiring stay intact.
const FAULT_MESSAGE = "Cannot read properties of null (reading 'id')";
vi.mock("@/modules/ee/sso/lib/better-auth-hooks", async (importActual) => ({
  ...(await importActual<typeof import("@/modules/ee/sso/lib/better-auth-hooks")>()),
  ssoLicenseGateBeforeHandler: vi.fn(async () => {
    throw new TypeError(FAULT_MESSAGE);
  }),
}));

const capturedFault = () => {
  const call = vi
    .mocked(Sentry.captureException)
    .mock.calls.find(([error]) => error instanceof TypeError && error.message === FAULT_MESSAGE);
  if (!call) throw new Error("the injected fault never reached Sentry.captureException");
  return { error: call[0], context: call[1] as { tags?: Record<string, unknown> } | undefined };
};

describe("Better Auth internal fault — Sentry capture carries the endpoint (real router)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("tags the capture with the endpoint the request was for", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "someone@example.com", password: "irrelevant" }),
      })
    );

    // The fault is internal, so Better Auth answers 500 — and before ENG-2259 that was all we knew.
    expect(response.status).toBe(500);

    const { context } = capturedFault();
    expect(context?.tags).toMatchObject({
      component: "better-auth",
      "auth.path": "/sign-in/email",
      "auth.method": "POST",
    });
  });

  test("never carries the token from /reset-password/:token, or anything from the query string", async () => {
    // A real password-reset token: better-auth declares this endpoint with the token as a PATH
    // segment, so an unsanitized capture would put a live account-takeover credential into Sentry.
    const token = "faketokenfaketokenfaketoken00001";
    const callbackSecret = "fakestatefakestatefakestate00001";

    await GET(
      new Request(
        `http://localhost/api/auth/reset-password/${token}?callbackURL=/auth/forgot-password/reset&state=${callbackSecret}`
      )
    );

    const { context } = capturedFault();
    // The endpoint is still named — only the secret in its path is dropped.
    expect(context?.tags).toMatchObject({ "auth.path": "/reset-password/*", "auth.method": "GET" });
    // Belt and braces: nothing anywhere in the captured payload, tags or extra.
    expect(JSON.stringify(context)).not.toContain(token);
    expect(JSON.stringify(context)).not.toContain(callbackSecret);
  });

  test("a handled APIError is still not captured — the ENG-2037 gate is unchanged", async () => {
    const { ssoLicenseGateBeforeHandler } = await import("@/modules/ee/sso/lib/better-auth-hooks");
    vi.mocked(ssoLicenseGateBeforeHandler).mockImplementationOnce(async () => {
      throw new APIError("FORBIDDEN", { message: "SSO is not enabled for this instance." });
    });

    const response = await POST(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "someone@example.com", password: "irrelevant" }),
      })
    );

    expect(response.status).toBe(403);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

/**
 * The labeller's unit tests prove the rules against a hand-written fixture, which cannot notice the
 * registry changing underneath them: a Better Auth upgrade that adds a parameterized endpoint — or
 * moves a parameter to the first segment — leaves every one of them green. These bind the same rules
 * to the REAL registry, so the upgrade breaks a test instead of leaking quietly.
 */
describe("the label vocabulary matches the real Better Auth registry", () => {
  const endpoints = Object.values(auth.api) as { path?: string; options?: { metadata?: unknown } }[];
  const declaredPaths = endpoints
    .map((endpoint) => endpoint.path)
    .filter((path): path is string => typeof path === "string");
  const label = createAuthPathLabeller(declaredPaths);

  test("the vocabulary is actually populated, and names a real endpoint in full", () => {
    // Guards the degenerate failure: if `auth` ever became lazy, the module-scope build in route.ts
    // would read an empty registry and label every request "unknown" — degraded, not leaky, but
    // silently useless.
    expect(declaredPaths.length).toBeGreaterThan(50);
    expect(label("http://localhost/api/auth/sign-in/email")).toBe("/sign-in/email");
  });

  test("no declared parameter sits in the first segment", () => {
    // The fallback emits the first segment, so a first-segment parameter is the one shape that could
    // put a caller-supplied value in a tag. It cannot today (a random value is not in the vocabulary,
    // so it labels "unknown"), but this keeps the assumption stated rather than assumed.
    const firstSegmentParams = declaredPaths.filter((path) => path.split("/")[1]?.startsWith(":"));

    expect(firstSegmentParams).toEqual([]);
  });

  test("every parameterized endpoint in the real registry degrades instead of emitting its parameter", () => {
    const parameterized = declaredPaths.filter((path) => path.includes(":"));
    // /callback/:id, /reset-password/:token, /oauth2/callback/:providerId at better-auth 1.6.23.
    expect(parameterized.length).toBeGreaterThan(0);

    for (const pattern of parameterized) {
      const secret = "faketokenfaketokenfaketoken00001";
      const concrete = pattern.replace(/:[^/]+/g, secret);

      expect(label(`http://localhost/api/auth${concrete}`)).not.toContain(secret);
    }
  });

  test("endpoints with no declared path are all server-only, so the vocabulary covers the HTTP surface", () => {
    // The vocabulary is derived from declared paths, so anything routable that lacks one would label
    // "unknown". Today the only path-less endpoints are SERVER_ONLY (setPassword, signJWT, verifyJWT,
    // generateTOTP, viewBackupCodes) and unreachable through auth.handler. better-call is moving
    // toward path-less endpoints in general, so if a routable one ever loses its path this fails.
    const routablePathless = endpoints.filter((endpoint) => {
      if (typeof endpoint.path === "string") return false;
      const metadata = endpoint.options?.metadata as { SERVER_ONLY?: boolean } | undefined;
      return metadata?.SERVER_ONLY !== true;
    });

    expect(routablePathless).toEqual([]);
  });
});
