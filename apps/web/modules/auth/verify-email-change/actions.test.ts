import { beforeEach, describe, expect, test, vi } from "vitest";
import { verifyEmailChangeToken } from "@/lib/jwt";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { getUser, updateUser } from "@/modules/auth/lib/user";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { verifyEmailChangeAction } from "./actions";

type VerifyEmailChangeHandler = (args: {
  ctx: { auditLoggingCtx: { userId?: string; oldObject?: unknown; newObject?: unknown } };
  parsedInput: { token: string };
}) => Promise<unknown>;

vi.mock("@/lib/jwt", () => ({
  verifyEmailChangeToken: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((handler: VerifyEmailChangeHandler) => handler),
  },
}));

vi.mock("@/modules/auth/lib/brevo", () => ({
  updateBrevoCustomer: vi.fn(),
}));

vi.mock("@/modules/auth/lib/user", () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action: string, _object: string, handler: VerifyEmailChangeHandler) => handler),
}));

describe("verifyEmailChangeAction", () => {
  const parsedInput = { token: "opaque-email-change-token" };
  const mockCtx = { auditLoggingCtx: {} };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(verifyEmailChangeToken).mockResolvedValue({ id: "user-123", email: "new@example.com" });
    vi.mocked(getUser).mockResolvedValue({ id: "user-123", email: "old@example.com" } as never);
    vi.mocked(updateUser).mockResolvedValue({ id: "user-123", email: "new@example.com" } as never);
    vi.mocked(updateBrevoCustomer).mockResolvedValue(undefined);
  });

  test("applies the verification IP limit before verifying the token", async () => {
    await verifyEmailChangeAction({ ctx: mockCtx, parsedInput } as never);

    expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
    expect(applyIPRateLimit).toHaveBeenCalledBefore(vi.mocked(verifyEmailChangeToken));
  });

  test("short-circuits before token processing and side effects when the IP limit is exceeded", async () => {
    vi.mocked(applyIPRateLimit).mockRejectedValue(
      new Error("Maximum number of requests reached. Please try again later.")
    );

    await expect(verifyEmailChangeAction({ ctx: mockCtx, parsedInput } as never)).rejects.toThrow(
      "Maximum number of requests reached. Please try again later."
    );
    expect(verifyEmailChangeToken).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(updateBrevoCustomer).not.toHaveBeenCalled();
  });
});
