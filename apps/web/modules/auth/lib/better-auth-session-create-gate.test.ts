import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireSsoSignInForSsoLinkedUser } from "@/modules/ee/sso/lib/sso-password-sign-in-gate";
import { gateSessionCreate } from "./better-auth-session-create-gate";

vi.mock("server-only", () => ({}));

vi.mock("@/modules/ee/sso/lib/sso-password-sign-in-gate", () => ({
  requireSsoSignInForSsoLinkedUser: vi.fn(),
}));

type TGateArgs = Parameters<typeof gateSessionCreate>;
const session = { userId: "user-1" } as TGateArgs[0];
const signInContext = { path: "/sign-in/email" } as TGateArgs[1];

const storedUser = (overrides: { isActive?: boolean; identityProvider?: "email" | "google" } = {}) =>
  prisma.user.findUnique.mockResolvedValue({
    id: "user-1",
    isActive: true,
    identityProvider: "google",
    ...overrides,
  } as never);

beforeEach(() => {
  vi.mocked(requireSsoSignInForSsoLinkedUser).mockReset();
});

describe("gateSessionCreate", () => {
  test("reads the user once, with only the columns both checks need", async () => {
    storedUser();

    await gateSessionCreate(session, signInContext);

    expect(prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id: "user-1" },
      select: { id: true, isActive: true, identityProvider: true },
    });
  });

  test("hands the user and the request path to the SSO check", async () => {
    storedUser();

    await gateSessionCreate(session, signInContext);

    expect(requireSsoSignInForSsoLinkedUser).toHaveBeenCalledExactlyOnceWith(
      { id: "user-1", isActive: true, identityProvider: "google" },
      "/sign-in/email"
    );
  });

  test("passes no path for a session created outside any endpoint", async () => {
    storedUser();

    await gateSessionCreate(session, null);

    expect(vi.mocked(requireSsoSignInForSsoLinkedUser).mock.calls[0]?.[1]).toBeUndefined();
  });

  test("refuses a deactivated user before the SSO check, so they are told they are inactive", async () => {
    storedUser({ isActive: false });

    await expect(gateSessionCreate(session, signInContext)).rejects.toMatchObject({
      body: { message: "Your account is currently inactive. Please contact the organization admin." },
    });
    expect(requireSsoSignInForSsoLinkedUser).not.toHaveBeenCalled();
  });

  test("lets the SSO check's refusal through", async () => {
    storedUser();
    const refusal = new Error("SSO_SIGN_IN_REQUIRED");
    vi.mocked(requireSsoSignInForSsoLinkedUser).mockRejectedValue(refusal);

    await expect(gateSessionCreate(session, signInContext)).rejects.toBe(refusal);
  });

  test("checks nothing for a user row that is gone", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(gateSessionCreate(session, signInContext)).resolves.toBeUndefined();
    expect(requireSsoSignInForSsoLinkedUser).not.toHaveBeenCalled();
  });
});
