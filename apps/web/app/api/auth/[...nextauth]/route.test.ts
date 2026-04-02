import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => {
  const nextAuthHandler = vi.fn(async () => new Response(null, { status: 200 }));
  const nextAuth = vi.fn(() => nextAuthHandler);

  return {
    nextAuth,
    nextAuthHandler,
    baseSignIn: vi.fn(async () => true),
    baseSession: vi.fn(async ({ session }: { session: unknown }) => session),
    baseEventSignIn: vi.fn(),
    queueAuditEventBackground: vi.fn(),
    captureException: vi.fn(),
    loggerError: vi.fn(),
  };
});

vi.mock("next-auth", () => ({
  default: mocks.nextAuth,
}));

vi.mock("@/lib/constants", () => ({
  IS_PRODUCTION: false,
  SENTRY_DSN: undefined,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: mocks.loggerError,
    })),
  },
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {
    callbacks: {
      signIn: mocks.baseSignIn,
      session: mocks.baseSession,
    },
    events: {
      signIn: mocks.baseEventSignIn,
    },
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: mocks.queueAuditEventBackground,
}));

const getWrappedAuthOptions = async (requestId: string = "req-123") => {
  const request = new Request("http://localhost/api/auth/signin", {
    headers: { "x-request-id": requestId },
  });

  await GET(request, {} as any);

  expect(mocks.nextAuth).toHaveBeenCalledTimes(1);

  return mocks.nextAuth.mock.calls[0][0];
};

describe("auth route audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("logs successful sign-in from the NextAuth signIn event after session creation", async () => {
    const authOptions = await getWrappedAuthOptions();
    const user = { id: "user_1", email: "user@example.com", name: "User Example" };
    const account = { provider: "keycloak" };

    await expect(authOptions.callbacks.signIn({ user, account })).resolves.toBe(true);
    expect(mocks.queueAuditEventBackground).not.toHaveBeenCalled();

    await authOptions.events.signIn({ user, account, isNewUser: false });

    expect(mocks.baseEventSignIn).toHaveBeenCalledWith({ user, account, isNewUser: false });
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signedIn",
        targetType: "user",
        userId: "user_1",
        targetId: "user_1",
        organizationId: "unknown",
        status: "success",
        userType: "user",
        newObject: expect.objectContaining({
          email: "user@example.com",
          authMethod: "sso",
          provider: "keycloak",
          sessionStrategy: "database",
          isNewUser: false,
        }),
      })
    );
  });

  test("logs failed sign-in attempts from the callback stage with the request event id", async () => {
    const error = new Error("Access denied");
    mocks.baseSignIn.mockRejectedValueOnce(error);

    const authOptions = await getWrappedAuthOptions("req-failure");
    const user = { id: "user_2", email: "user2@example.com" };
    const account = { provider: "credentials" };

    await expect(authOptions.callbacks.signIn({ user, account })).rejects.toThrow("Access denied");

    expect(mocks.baseEventSignIn).not.toHaveBeenCalled();
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signedIn",
        targetType: "user",
        userId: "user_2",
        targetId: "user_2",
        organizationId: "unknown",
        status: "failure",
        userType: "user",
        eventId: "req-failure",
        newObject: expect.objectContaining({
          email: "user2@example.com",
          authMethod: "password",
          provider: "credentials",
          errorMessage: "Access denied",
        }),
      })
    );
  });
});
