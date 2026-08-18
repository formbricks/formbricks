import { beforeEach, describe, expect, test, vi } from "vitest";
import { SIGNUP_DISABLED_ERROR_CODE } from "@formbricks/types/errors";
import { getIsFreshInstance } from "@/lib/instance/service";
import { isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { isUninvitedSignupAllowed, signupPolicyBeforeHandler } from "./signup-policy";

const constantsOverrides = vi.hoisted(() => ({ SIGNUP_ENABLED: true }));
vi.mock("@/lib/constants", () => ({
  get SIGNUP_ENABLED() {
    return constantsOverrides.SIGNUP_ENABLED;
  },
}));
vi.mock("@/lib/instance/service", () => ({ getIsFreshInstance: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: vi.fn() }));
vi.mock("@/modules/auth/lib/signup-request-context", () => ({ isSignupDomainAllowed: vi.fn() }));

/** A closed self-hosted instance: SIGNUP_ENABLED is always false there, and it already has users. */
const closeTheInstance = (): void => {
  constantsOverrides.SIGNUP_ENABLED = false;
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
};

const rawSignup = { path: "/sign-up/email" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  constantsOverrides.SIGNUP_ENABLED = true;
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
  vi.mocked(isSignupDomainAllowed).mockReturnValue(false);
});

describe("isUninvitedSignupAllowed", () => {
  test("allows when public sign-up is genuinely open", async () => {
    await expect(isUninvitedSignupAllowed()).resolves.toBe(true);
  });

  test("allows the initial administrator on a fresh instance", async () => {
    closeTheInstance();
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    await expect(isUninvitedSignupAllowed()).resolves.toBe(true);
  });

  test("refuses on a closed, already-provisioned instance", async () => {
    closeTheInstance();
    await expect(isUninvitedSignupAllowed()).resolves.toBe(false);
  });

  test("refuses when SIGNUP_ENABLED is set but the license forbids multiple organizations", async () => {
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    await expect(isUninvitedSignupAllowed()).resolves.toBe(false);
  });

  // The two orderings below are the reason this predicate short-circuits the way it does: an
  // unauthenticated caller must not be able to make us count the User table on every attempt.
  test("does not count users once public sign-up has answered the question", async () => {
    await expect(isUninvitedSignupAllowed()).resolves.toBe(true);
    expect(getIsFreshInstance).not.toHaveBeenCalled();
  });

  test("does not consult the license when SIGNUP_ENABLED is false", async () => {
    closeTheInstance();
    await isUninvitedSignupAllowed();
    expect(getIsMultiOrgEnabled).not.toHaveBeenCalled();
  });
});

describe("signupPolicyBeforeHandler", () => {
  test("rejects a raw credential sign-up on a closed instance", async () => {
    closeTheInstance();
    await expect(signupPolicyBeforeHandler(rawSignup)).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: SIGNUP_DISABLED_ERROR_CODE },
    });
  });

  test("ignores every path other than the credential sign-up route", async () => {
    closeTheInstance();
    for (const path of ["/sign-in/email", "/reset-password", "/oauth2/callback/openid", "/get-session"]) {
      await expect(signupPolicyBeforeHandler({ path } as never)).resolves.toBeUndefined();
    }
  });

  // createUserAction applies the full policy — including the invite exemption this hook cannot see —
  // and marks the request scope. Re-deciding here would reject legitimately invited sign-ups.
  test("exempts a sign-up routed through createUserAction", async () => {
    closeTheInstance();
    vi.mocked(isSignupDomainAllowed).mockReturnValue(true);
    await expect(signupPolicyBeforeHandler(rawSignup)).resolves.toBeUndefined();
    expect(getIsFreshInstance).not.toHaveBeenCalled();
  });

  test("allows a raw credential sign-up while the instance is still fresh", async () => {
    closeTheInstance();
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    await expect(signupPolicyBeforeHandler(rawSignup)).resolves.toBeUndefined();
  });

  test("allows a raw credential sign-up when public sign-up is open", async () => {
    await expect(signupPolicyBeforeHandler(rawSignup)).resolves.toBeUndefined();
  });
});
