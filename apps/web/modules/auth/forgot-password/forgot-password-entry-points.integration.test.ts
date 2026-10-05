import { beforeEach, describe, expect, test, vi } from "vitest";
import { flushAfter } from "@/integration/after";
import { resetDb } from "@/integration/reset-db";
import { WEBAPP_URL } from "@/lib/constants";
import { auth } from "@/modules/auth/lib/auth";
import { sendPasswordResetLinkEmail } from "@/modules/email";
import { forgotPasswordAction } from "./actions";

/**
 * ENG-3639: there is exactly one unauthenticated way to request a password reset, and it answers before
 * doing anything that depends on the address.
 *
 * Better Auth's native `POST /api/auth/request-password-reset` used to be a second way in. It looked the
 * user up, wrote a token and waited on SMTP before answering — so its timing told password accounts from
 * everything else — and it skipped the forgot-password flow's per-account mail limit (ENG-3640). It is
 * closed with `disabledPaths`, which only Better Auth's HTTP router reads; this suite proves both halves
 * against the real `auth` instance: the route is gone, and the in-process call every caller uses is not.
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

// Pinned rather than inherited from `.env`: PASSWORD_RESET_DISABLED=1 would short-circuit both paths
// before what this suite is about.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  PASSWORD_RESET_DISABLED: false,
  EMAIL_AUTH_ENABLED: true,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

const EMAIL = "alice@corporate-example.com";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  await auth.api.signUpEmail({ body: { email: EMAIL, password: "Passw0rd!", name: "Alice" } });
});

describe("password-reset entry points (real Postgres + Better Auth)", () => {
  test("the native HTTP endpoint is closed, and sends nothing for a real password account", async () => {
    const response = await auth.handler(
      new Request(`${WEBAPP_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: WEBAPP_URL },
        body: JSON.stringify({ email: EMAIL, redirectTo: `${WEBAPP_URL}/auth/forgot-password/reset` }),
      })
    );

    expect(response.status).toBe(404);
    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
  });

  test("the in-process call the app uses still sends the reset mail", async () => {
    // The guard for `disabledPaths`: if it ever reached `auth.api` too, the forgot-password flow and the
    // authenticated profile reset would both stop sending — silently, behind a generic success.
    await auth.api.requestPasswordReset({
      body: { email: EMAIL, redirectTo: `${WEBAPP_URL}/auth/forgot-password/reset` },
    });

    expect(sendPasswordResetLinkEmail).toHaveBeenCalledOnce();
  });

  test("the forgot-password action sends the reset mail only after it has answered", async () => {
    const result = await forgotPasswordAction({ email: EMAIL });

    expect(result?.data).toEqual({ success: true });
    await flushAfter();
    expect(vi.mocked(sendPasswordResetLinkEmail).mock.calls.map((call) => call[0].email)).toEqual([EMAIL]);
  });
});
