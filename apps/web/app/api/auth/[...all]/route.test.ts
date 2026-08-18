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
  handlerMock: vi.fn(async () => new Response("ok", { status: 200 })),
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
    },
  },
}));
vi.mock("@/modules/ee/sso/lib/sso-request-context", () => ({
  runWithSsoRequestContext: runWithCtxMock,
}));

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
    expect(handlerMock).toHaveBeenCalledWith(request);
    expect(calls).toEqual(["wrapper:start", "handler", "wrapper:end"]);
  });

  test("POST delegates to auth.handler within the SSO request context", async () => {
    const request = new Request("http://localhost/api/auth/sign-in/email", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(runWithCtxMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledWith(request);
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
    expect(seen).toEqual({ path: "reset-password", method: "POST" });
    expect(JSON.stringify(seen)).not.toContain(token);
  });
});
