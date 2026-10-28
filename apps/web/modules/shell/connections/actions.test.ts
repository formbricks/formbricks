import { beforeEach, describe, expect, test, vi } from "vitest";
import { revokeOAuthConnectionAction } from "./actions";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  deleteOAuthConsent: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })) },
}));
vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { api: { deleteOAuthConsent: mocks.deleteOAuthConsent } },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: (_action: string, _target: string, fn: unknown) => fn,
}));

const organizationId = "clh1234567890abcdefghijkl";

describe("revokeOAuthConnectionAction", () => {
  const ctx = () => ({ user: { id: "user-1" }, auditLoggingCtx: {} as Record<string, unknown> });

  beforeEach(() => {
    mocks.assertCan.mockReset();
    mocks.deleteOAuthConsent.mockReset();
  });

  test("files the audit event under the authorized organization, with the consent as target", async () => {
    const context = ctx();

    await revokeOAuthConnectionAction({
      ctx: context,
      parsedInput: { id: "consent-1", organizationId },
    } as never);

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "organization.read_access", {
      type: "organization",
      id: organizationId,
    });
    expect(context.auditLoggingCtx).toMatchObject({ organizationId, oauthConsentId: "consent-1" });
    expect(mocks.deleteOAuthConsent).toHaveBeenCalledWith(
      expect.objectContaining({ body: { id: "consent-1" } })
    );
  });

  test("revokes nothing and sets no audit organization when the person cannot read the organization", async () => {
    const context = ctx();
    mocks.assertCan.mockRejectedValueOnce(new Error("forbidden"));

    await expect(
      revokeOAuthConnectionAction({ ctx: context, parsedInput: { id: "consent-1", organizationId } } as never)
    ).rejects.toThrow("forbidden");

    expect(mocks.deleteOAuthConsent).not.toHaveBeenCalled();
    expect(context.auditLoggingCtx.organizationId).toBeUndefined();
  });
});
