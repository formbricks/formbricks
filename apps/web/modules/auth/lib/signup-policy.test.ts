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
const { loggerWarn } = vi.hoisted(() => ({ loggerWarn: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: loggerWarn } }));

/** A closed self-hosted instance: SIGNUP_ENABLED is always false there, and it already has users. */
const closeTheInstance = (): void => {
  constantsOverrides.SIGNUP_ENABLED = false;
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
};

// A sign-up that did not come through the sign-up route (no action mark in the request scope).
const unmarkedSignup = { path: "/sign-up/email" } as never;

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
  test("rejects a credential sign-up outside the action on a closed instance", async () => {
    closeTheInstance();
    await expect(signupPolicyBeforeHandler(unmarkedSignup)).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: SIGNUP_DISABLED_ERROR_CODE },
    });
  });

  // ENG-2347: the rejection is the only signal an operator of a closed instance gets that someone tried
  // to create an account outside the sign-up route, and the client-facing APIError is kept out of Sentry
  // on purpose (ENG-2037), so it needs a log line of its own.
  test("logs a warning when it rejects a sign-up", async () => {
    closeTheInstance();
    await expect(signupPolicyBeforeHandler(unmarkedSignup)).rejects.toBeDefined();
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(loggerWarn).toHaveBeenCalledWith(
      { path: "/sign-up/email" },
      expect.stringContaining("closed-sign-up policy")
    );
  });

  test("logs nothing when it allows a sign-up", async () => {
    await expect(signupPolicyBeforeHandler(unmarkedSignup)).resolves.toBeUndefined();
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  test("ignores every path other than the credential sign-up route", async () => {
    closeTheInstance();
    for (const path of ["/sign-in/email", "/reset-password", "/callback/openid", "/get-session"]) {
      await expect(signupPolicyBeforeHandler({ path } as never)).resolves.toBeUndefined();
    }
  });

  // the sign-up route applies the full policy — including the invite exemption this hook cannot see —
  // and marks the request scope. Re-deciding here would reject legitimately invited sign-ups.
  test("exempts a sign-up made through the sign-up route", async () => {
    closeTheInstance();
    vi.mocked(isSignupDomainAllowed).mockReturnValue(true);
    await expect(signupPolicyBeforeHandler(unmarkedSignup)).resolves.toBeUndefined();
    expect(getIsFreshInstance).not.toHaveBeenCalled();
  });

  test("allows a credential sign-up outside the action while the instance is still fresh", async () => {
    closeTheInstance();
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    await expect(signupPolicyBeforeHandler(unmarkedSignup)).resolves.toBeUndefined();
  });

  test("allows a credential sign-up outside the action when public sign-up is open", async () => {
    await expect(signupPolicyBeforeHandler(unmarkedSignup)).resolves.toBeUndefined();
  });
});
