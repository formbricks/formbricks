import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { POST as REQUEST_DELETION } from "./deletion-requests/route";
import { GET as GET_NOTIFICATIONS, PATCH as PATCH_NOTIFICATIONS } from "./notification-settings/route";
import { POST as REQUEST_PASSWORD_RESET } from "./password-resets/route";
import { PATCH as PATCH_PROFILE } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  verifyUserPassword: vi.fn(),
  getIsEmailUnique: vi.fn(),
  updateBrevoCustomer: vi.fn(),
  sendVerificationNewEmail: vi.fn(),
  applyRateLimit: vi.fn(),
  requestPasswordReset: vi.fn(),
  requestSsoAccountDeletionEmail: vi.fn(),
  getNotificationSettingsView: vi.fn(),
  updateNotificationSetting: vi.fn(),
  queueAuditEvent: vi.fn(),
  constants: { EMAIL_VERIFICATION_DISABLED: false, PASSWORD_RESET_DISABLED: false },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get EMAIL_VERIFICATION_DISABLED() {
      return mocks.constants.EMAIL_VERIFICATION_DISABLED;
    },
    get PASSWORD_RESET_DISABLED() {
      return mocks.constants.PASSWORD_RESET_DISABLED;
    },
    WEBAPP_URL: "https://app.example.com",
  };
});
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser, updateUser: mocks.updateUser }));
vi.mock("@/lib/user/password", () => ({ verifyUserPassword: mocks.verifyUserPassword }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/settings/account/profile/lib/user", () => ({
  getIsEmailUnique: mocks.getIsEmailUnique,
}));
vi.mock("@/modules/auth/lib/brevo", () => ({ updateBrevoCustomer: mocks.updateBrevoCustomer }));
vi.mock("@/modules/email", () => ({ sendVerificationNewEmail: mocks.sendVerificationNewEmail }));
vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { api: { requestPasswordReset: mocks.requestPasswordReset } },
}));
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/modules/account/lib/better-auth-account-deletion-request", () => ({
  requestSsoAccountDeletionEmail: mocks.requestSsoAccountDeletionEmail,
}));
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/settings/account/notifications/lib/notification-settings",
  () => ({
    getNotificationSettingsView: mocks.getNotificationSettingsView,
    updateNotificationSetting: mocks.updateNotificationSetting,
  })
);
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const ORG_ID = "clorg11111111111111111111";

const credentialUser = {
  id: USER_ID,
  name: "Ada Lovelace",
  email: "ada@example.com",
  locale: "en-US",
  identityProvider: "email",
};
const ssoUser = { ...credentialUser, identityProvider: "google" };

const send = (
  handler: (req: NextRequest, props: never) => Promise<Response>,
  path: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = SAME_ORIGIN_HEADERS
) =>
  handler(
    new NextRequest(`http://localhost/api/internal/users/me${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    {} as never
  );

const patchProfile = (body: unknown, headers?: Record<string, string>) =>
  send(PATCH_PROFILE, "", "PATCH", body, headers);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constants.EMAIL_VERIFICATION_DISABLED = false;
  mocks.constants.PASSWORD_RESET_DISABLED = false;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.getUser.mockResolvedValue(credentialUser);
  mocks.updateUser.mockImplementation(async (_id: string, data: object) => ({ ...credentialUser, ...data }));
  mocks.verifyUserPassword.mockResolvedValue(true);
  mocks.getIsEmailUnique.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
});

describe("PATCH /api/internal/users/me", () => {
  test("changes a credential user's name and locale and returns the profile", async () => {
    const response = await patchProfile({ name: "Ada King", locale: "de-DE" });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      id: USER_ID,
      name: "Ada King",
      email: "ada@example.com",
      locale: "de-DE",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith(USER_ID, { name: "Ada King", locale: "de-DE" });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "updated", targetType: "user", status: "success", targetId: USER_ID })
    );
  });

  test("refuses a name change from an SSO user: the identity provider owns it", async () => {
    mocks.getUser.mockResolvedValue(ssoUser);

    const response = await patchProfile({ name: "Someone Else" });

    expect(response.status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  test("lets an SSO user echo their unchanged name, and still change their locale", async () => {
    mocks.getUser.mockResolvedValue(ssoUser);

    const response = await patchProfile({ name: "Ada Lovelace", locale: "fr-FR" });

    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith(USER_ID, { name: "Ada Lovelace", locale: "fr-FR" });
  });

  test("sends a verification email instead of changing the address when verification is on", async () => {
    const response = await patchProfile({ email: "new@example.com", password: "Correct-horse-1" });

    expect(response.status).toBe(200);
    expect(mocks.verifyUserPassword).toHaveBeenCalledWith(USER_ID, "Correct-horse-1");
    expect(mocks.sendVerificationNewEmail).toHaveBeenCalledWith(USER_ID, "new@example.com", "en-US");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:email" }),
      USER_ID
    );
  });

  test("changes the address at once when email verification is off", async () => {
    mocks.constants.EMAIL_VERIFICATION_DISABLED = true;

    const response = await patchProfile({ email: "New@Example.com", password: "Correct-horse-1" });

    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith(USER_ID, { email: "new@example.com" });
    expect(mocks.updateBrevoCustomer).toHaveBeenCalledWith({ id: USER_ID, email: "new@example.com" });
  });

  test("answers 400 for an email change without the password", async () => {
    const response = await patchProfile({ email: "new@example.com" });

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      { name: "password", reason: "Required to change the email address." },
    ]);
    expect(mocks.sendVerificationNewEmail).not.toHaveBeenCalled();
  });

  test("answers 403 for a wrong password and changes nothing", async () => {
    mocks.verifyUserPassword.mockResolvedValue(false);

    const response = await patchProfile({ email: "new@example.com", password: "Wrong-password-1" });

    expect(response.status).toBe(403);
    expect(mocks.sendVerificationNewEmail).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  test("answers the same success for an address another account already uses, sending nothing", async () => {
    mocks.getIsEmailUnique.mockResolvedValue(false);

    const response = await patchProfile({ email: "taken@example.com", password: "Correct-horse-1" });

    expect(response.status).toBe(200);
    expect(mocks.sendVerificationNewEmail).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  test("refuses an email change from an SSO user", async () => {
    mocks.getUser.mockResolvedValue(ssoUser);

    const response = await patchProfile({ email: "new@example.com", password: "Correct-horse-1" });

    expect(response.status).toBe(403);
    expect(mocks.verifyUserPassword).not.toHaveBeenCalled();
  });

  test("answers 429 once the email-change rate limit is hit", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === "action:email") throw new TooManyRequestsError("Too many requests");
    });

    const response = await patchProfile({ email: "new@example.com", password: "Correct-horse-1" });

    expect(response.status).toBe(429);
    expect(mocks.verifyUserPassword).not.toHaveBeenCalled();
  });

  test.each([
    ["an unknown field", { name: "Ada", role: "owner" }],
    ["an invalid locale", { locale: "xx-XX" }],
    ["a malformed email", { email: "not-an-email", password: "x" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await patchProfile(body)).status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF) and answers 401 without a session", async () => {
    expect((await patchProfile({ name: "x" }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    mocks.getSession.mockResolvedValue(null);
    expect((await patchProfile({ name: "x" })).status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});

describe("/api/internal/users/me/notification-settings", () => {
  const settings = { alert: { [SURVEY_ID]: true }, unsubscribedOrganizationIds: [] };

  test("GET answers with every switch from the shared read model", async () => {
    mocks.getNotificationSettingsView.mockResolvedValue({ settings, memberships: [] });

    const response = await send(GET_NOTIFICATIONS, "/notification-settings", "GET");

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(settings);
    expect(mocks.getNotificationSettingsView).toHaveBeenCalledWith(USER_ID);
  });

  test("PATCH flips one switch for the caller only, and audits before and after", async () => {
    const after = { ...settings, alert: { [SURVEY_ID]: false } };
    mocks.updateNotificationSetting.mockResolvedValue({ before: settings, after });

    const toggle = { type: "alert", surveyId: SURVEY_ID, enabled: false };
    const response = await send(PATCH_NOTIFICATIONS, "/notification-settings", "PATCH", toggle);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(after);
    expect(mocks.updateNotificationSetting).toHaveBeenCalledWith(USER_ID, toggle);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: USER_ID,
        oldObject: { notificationSettings: settings },
        newObject: { notificationSettings: after },
      })
    );
  });

  test.each([
    ["the whole settings object (the old shape)", settings],
    ["an unknown switch type", { type: "weeklySummary", surveyId: SURVEY_ID, enabled: true }],
    [
      "an organization switch with a survey field",
      { type: "organizationEmails", surveyId: ORG_ID, subscribed: true },
    ],
    ["a non-boolean", { type: "alert", surveyId: SURVEY_ID, enabled: "yes" }],
  ])("PATCH answers 400 for %s", async (_label, body) => {
    expect((await send(PATCH_NOTIFICATIONS, "/notification-settings", "PATCH", body)).status).toBe(400);
    expect(mocks.updateNotificationSetting).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/users/me/password-resets", () => {
  test("emails a credential user a reset link to this instance", async () => {
    const response = await send(REQUEST_PASSWORD_RESET, "/password-resets", "POST");

    expect(response.status).toBe(202);
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: "ada@example.com", redirectTo: "https://app.example.com/auth/forgot-password/reset" },
      })
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "passwordReset", status: "success", targetId: USER_ID })
    );
  });

  test("answers 403 for an SSO user, who has no password", async () => {
    mocks.getUser.mockResolvedValue(ssoUser);
    expect((await send(REQUEST_PASSWORD_RESET, "/password-resets", "POST")).status).toBe(403);
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  test("answers 403 when password reset is disabled on the instance", async () => {
    mocks.constants.PASSWORD_RESET_DISABLED = true;
    expect((await send(REQUEST_PASSWORD_RESET, "/password-resets", "POST")).status).toBe(403);
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  test("refuses a request with neither Sec-Fetch-Site nor Origin (CSRF)", async () => {
    expect((await send(REQUEST_PASSWORD_RESET, "/password-resets", "POST", undefined, {})).status).toBe(403);
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/users/me/deletion-requests", () => {
  test("emails an SSO user the deletion link, within the account-deletion rate limit", async () => {
    mocks.getUser.mockResolvedValue(ssoUser);

    const response = await send(REQUEST_DELETION, "/deletion-requests", "POST");

    expect(response.status).toBe(202);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:account-delete" }),
      USER_ID
    );
    expect(mocks.requestSsoAccountDeletionEmail).toHaveBeenCalledOnce();
  });

  test("answers 403 for a credential user, who confirms with a password instead", async () => {
    mocks.requestSsoAccountDeletionEmail.mockRejectedValue(new AuthorizationError("Password confirmation"));
    expect((await send(REQUEST_DELETION, "/deletion-requests", "POST")).status).toBe(403);
  });

  test("answers 429 past the rate limit, sending nothing", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === "action:account-delete") throw new TooManyRequestsError("Too many requests");
    });
    expect((await send(REQUEST_DELETION, "/deletion-requests", "POST")).status).toBe(429);
    expect(mocks.requestSsoAccountDeletionEmail).not.toHaveBeenCalled();
  });
});
