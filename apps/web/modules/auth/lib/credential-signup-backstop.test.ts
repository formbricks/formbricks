import { beforeEach, describe, expect, test, vi } from "vitest";
import { SIGNUP_DISABLED_ERROR_CODE } from "@formbricks/types/errors";
import { getIsFreshInstance } from "@/lib/instance/service";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { enforceCredentialSignupBackstop } from "./credential-signup-backstop";

vi.mock("@/modules/auth/lib/signup-email-domain", () => ({ isSignupEmailDomainBlocked: vi.fn() }));
vi.mock("@/modules/auth/lib/signup-request-context", () => ({ isSignupDomainAllowed: vi.fn() }));
vi.mock("@/lib/instance/service", () => ({ getIsFreshInstance: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: vi.fn() }));

const constantsOverrides = vi.hoisted(() => ({ SIGNUP_ENABLED: true }));
vi.mock("@/lib/constants", () => ({
  get SIGNUP_ENABLED() {
    return constantsOverrides.SIGNUP_ENABLED;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  constantsOverrides.SIGNUP_ENABLED = true;
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
});

/**
 * The credential half of Better Auth's `user.create.before` hook, extracted from the SSO hooks module
 * (ENG-2589). Behaviour is unchanged — these cases moved here with it, because this is where the policy
 * they describe now lives.
 *
 * The return values are Better Auth's hook contract, so they are asserted literally: `false` blocks the
 * insert silently, a throw blocks it with a surfaced error, `undefined` continues.
 */
describe("enforceCredentialSignupBackstop", () => {
  test("blocks a sign-up that bypassed the action (raw /sign-up/email) with a blocked domain", async () => {
    vi.mocked(isSignupDomainAllowed).mockReturnValue(false); // no action mark → direct native-endpoint POST
    vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(true);

    expect(await enforceCredentialSignupBackstop("spammer@gmail.com")).toBe(false);
  });

  test("skips the domain re-check when the action already enforced it", async () => {
    vi.mocked(isSignupDomainAllowed).mockReturnValue(true); // action marked the scope
    vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(true); // would block, but must be skipped

    expect(await enforceCredentialSignupBackstop("spammer@gmail.com")).toBeUndefined();
    expect(isSignupEmailDomainBlocked).not.toHaveBeenCalled();
  });

  test("allows an allowed domain on the raw endpoint", async () => {
    vi.mocked(isSignupDomainAllowed).mockReturnValue(false);
    vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(false);

    expect(await enforceCredentialSignupBackstop("person@acme-corp.com")).toBeUndefined();
  });

  // ENG-2293: on a closed instance (SIGNUP_ENABLED=false, not fresh, multi-org disabled), a direct POST
  // to Better Auth's native /sign-up/email must be blocked — this is the last line of defense, since
  // the page and the server action both gate correctly.
  describe("closed-instance policy", () => {
    beforeEach(() => {
      constantsOverrides.SIGNUP_ENABLED = false;
      vi.mocked(getIsFreshInstance).mockResolvedValue(false);
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
      vi.mocked(isSignupDomainAllowed).mockReturnValue(false); // raw endpoint, not through the action
      vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(false); // self-hosted: domain block is a no-op
    });

    test("blocks a raw sign-up on a closed instance", async () => {
      // The stable code is the contract callers localize against; the message is display copy, so a
      // reworded message must not fail this test and a dropped code must.
      await expect(enforceCredentialSignupBackstop("intruder@example.com")).rejects.toMatchObject({
        status: "FORBIDDEN",
        body: { code: SIGNUP_DISABLED_ERROR_CODE },
      });
    });

    test("still allows the first administrator during fresh-instance setup", async () => {
      vi.mocked(getIsFreshInstance).mockResolvedValue(true);

      expect(await enforceCredentialSignupBackstop("admin@example.com")).toBeUndefined();
    });

    test("still allows a sign-up when public signup is open", async () => {
      constantsOverrides.SIGNUP_ENABLED = true;
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);

      expect(await enforceCredentialSignupBackstop("user@example.com")).toBeUndefined();
    });

    test("still allows a sign-up that went through the action", async () => {
      vi.mocked(isSignupDomainAllowed).mockReturnValue(true); // action marked the scope

      expect(await enforceCredentialSignupBackstop("user@example.com")).toBeUndefined();
    });
  });
});
