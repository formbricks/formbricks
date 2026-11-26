import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { hashString } from "@/lib/hash-string";
import { reserveRateLimitUsage, settleRateLimitUsage } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { settleSignInBudgetAfterHandler, signInBudgetBeforeHandler } from "./better-auth-sign-in-budget";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  reserveRateLimitUsage: vi.fn(),
  settleRateLimitUsage: vi.fn(),
}));

const budget = rateLimitConfigs.auth.loginFailuresPerAccount;
const reservation = { settled: false } as never;
const hook = (path: string, body: unknown, context: Record<string, unknown> = {}) =>
  ({ path, body, context }) as never;
const wrongPassword = new APIError("UNAUTHORIZED", {
  message: "Invalid email or password",
  code: "INVALID_EMAIL_OR_PASSWORD",
});

/** Runs both hooks on one request context, the way Better Auth does. */
const signIn = async (email: string, returned: unknown) => {
  const context: Record<string, unknown> = {};
  await signInBudgetBeforeHandler(hook("/sign-in/email", { email }, context));
  context.returned = returned;
  await settleSignInBudgetAfterHandler(hook("/sign-in/email", { email }, context));
};

describe("sign-in failure budget (SEC-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reserveRateLimitUsage).mockResolvedValue(reservation);
  });

  test("the config is a fail-closed brute-force guard of 10 per 15 minutes", () => {
    expect(budget).toEqual({
      interval: 900,
      allowedPerInterval: 10,
      namespace: "auth:login:account",
      failClosed: true,
    });
  });

  describe("before hook", () => {
    test("reserves a unit before the password is checked, keyed on the lowercased address", async () => {
      await signInBudgetBeforeHandler(hook("/sign-in/email", { email: "Victim@Example.com" }));

      expect(reserveRateLimitUsage).toHaveBeenCalledWith(budget, hashString("victim@example.com"));
    });

    test("refuses with a 429 once the account's budget is spent, whatever the password", async () => {
      vi.mocked(reserveRateLimitUsage).mockRejectedValue(new TooManyRequestsError("limit"));

      await expect(
        signInBudgetBeforeHandler(hook("/sign-in/email", { email: "victim@example.com", password: "right" }))
      ).rejects.toMatchObject({ statusCode: 429 });
    });

    test("does not turn an unexpected error into a lockout message", async () => {
      vi.mocked(reserveRateLimitUsage).mockRejectedValue(new Error("boom"));

      await expect(
        signInBudgetBeforeHandler(hook("/sign-in/email", { email: "victim@example.com" }))
      ).rejects.toThrow("boom");
    });

    test.each([
      ["another path", "/sign-up/email", { email: "a@b.co" }],
      ["a body without an address", "/sign-in/email", {}],
      ["a non-string address", "/sign-in/email", { email: 42 }],
      ["an empty address", "/sign-in/email", { email: "  " }],
    ])("ignores %s", async (_label, path, body) => {
      await signInBudgetBeforeHandler(hook(path, body));

      expect(reserveRateLimitUsage).not.toHaveBeenCalled();
    });
  });

  describe("after hook", () => {
    test("keeps the unit for a wrong password", async () => {
      await signIn("a@b.co", wrongPassword);

      expect(settleRateLimitUsage).not.toHaveBeenCalled();
    });

    test("keeps the unit for an unknown address the same way, so a lock reveals nothing", async () => {
      await signIn("nobody@example.com", wrongPassword);

      expect(reserveRateLimitUsage).toHaveBeenCalledTimes(1);
      expect(settleRateLimitUsage).not.toHaveBeenCalled();
    });

    test("gives the unit back for a successful sign-in", async () => {
      await signIn("a@b.co", { token: "t" });

      expect(settleRateLimitUsage).toHaveBeenCalledWith(reservation, 0);
    });

    test("gives the unit back for a rejection that is not a wrong password", async () => {
      await signIn("a@b.co", new APIError("FORBIDDEN", { message: "x", code: "EMAIL_NOT_VERIFIED" }));

      expect(settleRateLimitUsage).toHaveBeenCalledWith(reservation, 0);
    });

    test("does nothing when the before hook left no reservation (limits disabled, other path)", async () => {
      await settleSignInBudgetAfterHandler(hook("/sign-in/email", { email: "a@b.co" }, { returned: {} }));
      await settleSignInBudgetAfterHandler(hook("/two-factor/verify-totp", {}, { returned: wrongPassword }));

      expect(settleRateLimitUsage).not.toHaveBeenCalled();
    });
  });
});
