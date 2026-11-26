import { APIError } from "better-auth/api";
import { describe, expect, test, vi } from "vitest";
import { maskUnverifiedSignInAfterHandler } from "./better-auth-unverified-sign-in";

vi.mock("server-only", () => ({}));

const unverified = new APIError("FORBIDDEN", { message: "Email not verified", code: "EMAIL_NOT_VERIFIED" });
const wrongPassword = new APIError("UNAUTHORIZED", {
  message: "Invalid email or password",
  code: "INVALID_EMAIL_OR_PASSWORD",
});
const httpRequest = new Request("http://localhost:3000/api/auth/sign-in/email", { method: "POST" });

const hook = (path: string, returned: unknown, { overHttp = true } = {}) =>
  ({ path, request: overHttp ? httpRequest : undefined, context: { returned } }) as never;

describe("maskUnverifiedSignInAfterHandler (ENG-2099)", () => {
  test("answers an unverified account's sign-in over HTTP with the wrong-password response", async () => {
    const response = await maskUnverifiedSignInAfterHandler(hook("/sign-in/email", unverified));

    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(401);
    expect(response?.statusText).toBe("UNAUTHORIZED");
    expect(response?.headers.get("content-type")).toBe("application/json");
    expect(await response?.json()).toEqual({
      message: "Invalid email or password",
      code: "INVALID_EMAIL_OR_PASSWORD",
    });
  });

  test("throws the wrong-password error for a server-side call, which has no request", async () => {
    await expect(
      maskUnverifiedSignInAfterHandler(hook("/sign-in/email", unverified, { overHttp: false }))
    ).rejects.toMatchObject({
      statusCode: 401,
      body: { message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" },
    });
  });

  test.each([
    ["a wrong password", "/sign-in/email", wrongPassword],
    ["a successful sign-in", "/sign-in/email", { token: "t" }],
    ["no response yet", "/sign-in/email", undefined],
    ["EMAIL_NOT_VERIFIED on another path", "/send-verification-email", unverified],
  ])("leaves %s alone", async (_label, path, returned) => {
    await expect(maskUnverifiedSignInAfterHandler(hook(path, returned))).resolves.toBeUndefined();
  });
});
