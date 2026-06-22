import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "./route";

// Mock the BA instance + the SSO request-context wrapper so the route's delegation can be asserted
// without the real auth graph. The wrapper's own AsyncLocalStorage behavior is covered in
// sso-request-context's tests + the cutover integration check (runbook §4); here we assert the route
// runs `auth.handler` INSIDE `runWithSsoRequestContext` for both verbs.
const { handlerMock, runWithCtxMock } = vi.hoisted(() => ({
  handlerMock: vi.fn(async () => new Response("ok", { status: 200 })),
  runWithCtxMock: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock("@/modules/auth/lib/auth", () => ({ auth: { handler: handlerMock } }));
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
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(runWithCtxMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledWith(request);
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
