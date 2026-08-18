import * as Sentry from "@sentry/nextjs";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";

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
    expect(context?.tags).toMatchObject({ "auth.path": "reset-password", "auth.method": "GET" });
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
