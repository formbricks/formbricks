import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { disableTwoFactorAuthAction, enableTwoFactorAuthAction, setupTwoFactorAuthAction } from "./actions";
import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "./lib/two-factor-auth";

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action: string, _target: string, fn: unknown) => fn),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsTwoFactorAuthEnabled: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { twoFactorManage: { namespace: "action:two-factor-manage" } } },
}));
vi.mock("./lib/two-factor-auth", () => ({
  setupTwoFactorAuth: vi.fn(),
  enableTwoFactorAuth: vi.fn(),
  disableTwoFactorAuth: vi.fn(),
}));

const userId = "user-1";
const call = (action: unknown, parsedInput: unknown) =>
  (action as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: userId }, auditLoggingCtx: {} },
    parsedInput,
  });

const actions = [
  {
    name: "setup",
    action: setupTwoFactorAuthAction,
    input: { password: "pw" },
    lib: setupTwoFactorAuth,
  },
  { name: "enable", action: enableTwoFactorAuthAction, input: { code: "123456" }, lib: enableTwoFactorAuth },
  {
    name: "disable",
    action: disableTwoFactorAuthAction,
    input: { password: "pw", code: "123456" },
    lib: disableTwoFactorAuth,
  },
];

describe("two-factor management actions are throttled per account (SEC-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIsTwoFactorAuthEnabled).mockResolvedValue(true);
  });

  test.each(actions)("$name spends the account's budget before it verifies anything", async (entry) => {
    await call(entry.action, entry.input);

    expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.twoFactorManage, userId);
    expect(vi.mocked(applyRateLimit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(entry.lib).mock.invocationCallOrder[0]
    );
  });

  test.each(actions)(
    "$name never reaches the password or code check once the budget is spent",
    async (entry) => {
      vi.mocked(applyRateLimit).mockRejectedValue(
        new TooManyRequestsError("Maximum number of requests reached.")
      );

      await expect(call(entry.action, entry.input)).rejects.toBeInstanceOf(TooManyRequestsError);
      expect(entry.lib).not.toHaveBeenCalled();
    }
  );
});
