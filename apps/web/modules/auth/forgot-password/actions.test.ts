import { beforeEach, describe, expect, test, vi } from "vitest";
import { processPasswordResetRequest } from "@/modules/auth/forgot-password/lib/password-reset-request";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { forgotPasswordAction } from "./actions";

const mocks = vi.hoisted(() => ({
  passwordResetDisabled: { value: false },
  // The wrapper is applied once at module import, so `vi.resetAllMocks()` in beforeEach would wipe the
  // call history before any test could read it. A plain array on the hoisted object survives the reset.
  auditWrapperArgs: [] as [string, string][],
  // Callbacks handed to `after()`. Captured rather than run, so a test can tell "scheduled for after the
  // response" from "done before it" — the whole property this action exists to hold.
  afterCallbacks: [] as (() => unknown)[],
}));

vi.mock("@/lib/constants", () => ({
  get PASSWORD_RESET_DISABLED() {
    return mocks.passwordResetDisabled.value;
  },
}));

// Passthrough so the handler runs directly, matching modules/ee/billing/actions.test.ts. Importing the
// real handler would drag the audit-log graph (and its POSTHOG_KEY constant read) into this suite.
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((action: string, target: string, fn: unknown) => {
    mocks.auditWrapperArgs.push([action, target]);
    return fn;
  }),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    auth: { forgotPassword: { interval: 3600, allowedPerInterval: 5, namespace: "auth:forgot" } },
  },
}));

vi.mock("@/modules/auth/forgot-password/lib/password-reset-request", () => ({
  processPasswordResetRequest: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers({ "user-agent": "vitest" }))),
}));

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  }),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

/** Fresh audit context per call — the action writes `suppressEvent` onto it. */
let auditLoggingCtx: Record<string, unknown>;
const callAction = (email = "test@example.com") => {
  auditLoggingCtx = { ipAddress: "203.0.113.7" };
  return forgotPasswordAction({ ctx: { auditLoggingCtx }, parsedInput: { email } } as never);
};

/** Run what the action deferred past its response, as Next does once the response is sent. */
const runAfterCallbacks = async () => {
  for (const callback of mocks.afterCallbacks.splice(0)) {
    await callback();
  }
};

describe("forgotPasswordAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.passwordResetDisabled.value = false;
    mocks.afterCallbacks.length = 0;
  });

  test("answers before doing anything that depends on the address", async () => {
    const result = await callAction("someone@example.com");

    // The response is out and the per-address work has not started: so nothing about the address —
    // whether it exists, has a password, or is throttled — can show in the answer or its timing.
    expect(result).toEqual({ success: true });
    expect(processPasswordResetRequest).not.toHaveBeenCalled();

    await runAfterCallbacks();
    expect(processPasswordResetRequest).toHaveBeenCalledExactlyOnceWith({
      email: "someone@example.com",
      requestHeaders: expect.any(Headers),
      ipAddress: "203.0.113.7",
    });
  });

  test("hands over a copy of the request headers, which Better Auth reads after the response", async () => {
    await callAction();
    await runAfterCallbacks();

    const { requestHeaders } = vi.mocked(processPasswordResetRequest).mock.calls[0][0];
    expect(requestHeaders.get("user-agent")).toBe("vitest");
  });

  test("applies the IP rate limit, with its config, before scheduling anything", async () => {
    await callAction();

    expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.forgotPassword);
    expect(mocks.afterCallbacks).toHaveLength(1);
  });

  test("throws and schedules nothing when the IP rate limit is exceeded", async () => {
    vi.mocked(applyIPRateLimit).mockRejectedValue(new Error("Maximum number of requests reached."));

    await expect(callAction()).rejects.toThrow("Maximum number of requests reached.");
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  test("throws and schedules nothing when password reset is disabled", async () => {
    mocks.passwordResetDisabled.value = true;

    await expect(callAction()).rejects.toThrow("Password reset is disabled");
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  describe("Audit record", () => {
    /**
     * Without this the whole audit story is unobserved: `withAuditLogging` is mocked as a passthrough and
     * `actionClient.action` returns the handler, so deleting the wrapper from the action entirely would
     * leave every other test in this file green. This is the only assertion that failures are still
     * audited under the right action and target.
     */
    test("wires the wrapper with the right audit action and target", () => {
      expect(mocks.auditWrapperArgs).toContainEqual(["passwordReset", "user"]);
    });

    test("leaves the success event to the deferred work, which alone knows if a reset was requested", async () => {
      await callAction();

      expect(auditLoggingCtx.suppressEvent).toBe(true);
    });
  });
});
