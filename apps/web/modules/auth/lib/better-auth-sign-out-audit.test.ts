import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { twoFactor } from "better-auth/plugins";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { auditSignOutOnSessionDelete } from "./better-auth-observability";

/**
 * The `userSignedOut` audit against a real Better Auth (memory adapter): which session deletions are a
 * sign-out. Better Auth deletes sessions on several paths, and only `/sign-out` may record one.
 */

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventBackground: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), warn: vi.fn() },
}));
vi.mock("@/lib/constants", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/constants")>()),
  AUDIT_LOG_ENABLED: true,
  AUDIT_LOG_GET_USER_IP: false,
}));

const BASE_URL = "http://localhost:3000";
const EMAIL = "ada@example.com";
const PASSWORD = "Passw0rd!long";
const USER_AGENT = "sign-out-audit-test";

const buildAuth = () => {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
  };
  const resetTokens: string[] = [];
  // The path of every session deletion the hook saw, so a test can show the deletion it expects did
  // happen and was passed over, rather than never reaching the hook at all.
  const deletions: (string | undefined)[] = [];
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: "sign-out-audit-test-secret-0123456789abcdef",
    database: memoryAdapter(db),
    emailAndPassword: {
      enabled: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ token }) => {
        resetTokens.push(token);
      },
    },
    plugins: [twoFactor()],
    databaseHooks: {
      session: {
        delete: {
          after: async (session, ctx) => {
            deletions.push(ctx?.path);
            await auditSignOutOnSessionDelete(session, ctx);
          },
        },
      },
    },
  });
  return { auth, db, resetTokens, deletions };
};

const post = (auth: ReturnType<typeof buildAuth>["auth"], path: string, body: unknown, cookie?: string) =>
  auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        "user-agent": USER_AGENT,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

const signedOutEvents = () =>
  vi.mocked(queueAuditEventBackground).mock.calls.filter(([event]) => event.action === "userSignedOut");

const signUpAndSignIn = async (setup: ReturnType<typeof buildAuth>) => {
  await setup.auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: "Ada" } });
  const signIn = await post(setup.auth, "/sign-in/email", { email: EMAIL, password: PASSWORD });
  return { userId: setup.db.user[0].id as string, signIn };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queueAuditEventBackground).mockResolvedValue(undefined);
});

describe("auditSignOutOnSessionDelete (real Better Auth)", () => {
  test("a sign-out records one userSignedOut for the session's user, with the request's user agent", async () => {
    const setup = buildAuth();
    const { userId, signIn } = await signUpAndSignIn(setup);
    vi.clearAllMocks();

    const response = await post(setup.auth, "/sign-out", {}, cookieOf(signIn));

    expect(response.status).toBe(200);
    expect(setup.deletions).toEqual(["/sign-out"]);
    expect(signedOutEvents()).toHaveLength(1);
    expect(signedOutEvents()[0][0]).toEqual({
      action: "userSignedOut",
      targetType: "user",
      userId,
      targetId: userId,
      organizationId: "unknown",
      status: "success",
      userType: "user",
      newObject: { provider: "session", authMethod: "sign_out" },
      requestMetadata: { ipAddress: "unknown", userAgent: USER_AGENT },
    });
  });

  test("a sign-out with no session records nothing", async () => {
    const setup = buildAuth();

    expect((await post(setup.auth, "/sign-out", {})).status).toBe(200);
    expect(setup.deletions).toEqual([]);
    expect(signedOutEvents()).toHaveLength(0);
  });

  test("the two-factor password step, whose session the plugin withdraws, records nothing", async () => {
    const setup = buildAuth();
    await setup.auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: "Ada" } });
    setup.db.user[0].twoFactorEnabled = true;
    vi.clearAllMocks();

    const signIn = await post(setup.auth, "/sign-in/email", { email: EMAIL, password: PASSWORD });

    // Anti-vacuity: the password step really did create and then withdraw a session.
    expect(await signIn.json()).toEqual(expect.objectContaining({ twoFactorRedirect: true }));
    expect(setup.deletions).toEqual(["/sign-in/email"]);
    expect(signedOutEvents()).toHaveLength(0);
  });

  test("a password reset, which revokes the user's sessions, records no userSignedOut", async () => {
    const setup = buildAuth();
    await signUpAndSignIn(setup);
    await setup.auth.api.requestPasswordReset({ body: { email: EMAIL, redirectTo: "/" } });
    vi.clearAllMocks();

    const response = await post(setup.auth, "/reset-password", {
      token: setup.resetTokens[0],
      newPassword: "N3wPassw0rd!long",
    });

    // Anti-vacuity: the reset went through and swept the sessions, through the hook.
    expect(response.status).toBe(200);
    expect(setup.db.session).toHaveLength(0);
    expect(setup.deletions).toContain("/reset-password");
    expect(signedOutEvents()).toHaveLength(0);
  });

  test("never throws when the audit queue fails", async () => {
    vi.mocked(queueAuditEventBackground).mockRejectedValueOnce(new Error("redis down"));

    await expect(
      auditSignOutOnSessionDelete(
        { userId: "user-1" } as never,
        {
          path: "/sign-out",
          headers: new Headers(),
        } as never
      )
    ).resolves.toBeUndefined();
  });

  test("records nothing for a deletion outside a request", async () => {
    await auditSignOutOnSessionDelete({ userId: "user-1" } as never, null);

    expect(queueAuditEventBackground).not.toHaveBeenCalled();
  });
});
