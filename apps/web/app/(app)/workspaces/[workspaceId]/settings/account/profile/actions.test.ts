import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { updateUserAction } from "./actions";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  getIsEmailUnique: vi.fn(),
  verifyUserPassword: vi.fn(),
  applyRateLimit: vi.fn(),
  updateBrevoCustomer: vi.fn(),
  sendVerificationNewEmail: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
    // resetPasswordAction in the same module takes no input schema and calls `.action` directly.
    action: vi.fn((fn) => fn),
  },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser, updateUser: mocks.updateUser }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/settings/account/profile/lib/user", () => ({
  getIsEmailUnique: mocks.getIsEmailUnique,
}));
vi.mock("@/lib/user/password", () => ({ verifyUserPassword: mocks.verifyUserPassword }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/auth/lib/brevo", () => ({ updateBrevoCustomer: mocks.updateBrevoCustomer }));
vi.mock("@/modules/email", () => ({ sendVerificationNewEmail: mocks.sendVerificationNewEmail }));
vi.mock("@/modules/auth/lib/auth", () => ({ auth: { api: { revokeUserSessions: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const ctxFor = (identityProvider: string, name = "Doe, Jane") => ({
  user: { id: "user-1", name, email: "jane@corp.test", locale: "en-US", identityProvider },
  auditLoggingCtx: {} as Record<string, unknown>,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ id: "user-1", name: "Doe, Jane" });
  mocks.updateUser.mockResolvedValue({ id: "user-1", name: "Doe, Jane" });
});

// The identity provider owns User.name and re-writes it on every sign-in, so the profile form renders
// the input disabled. These cover the server boundary, which is what a crafted request actually meets.
describe("updateUserAction — name is IdP-owned for SSO users", () => {
  test("rejects a name change from an SSO user", async () => {
    await expect(
      (updateUserAction as unknown as (a: unknown) => Promise<unknown>)({
        ctx: ctxFor("azuread"),
        parsedInput: { name: "Jane Doe-Smith" },
      })
    ).rejects.toThrow(OperationNotAllowedError);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  test("allows a name change from a credential user", async () => {
    await (updateUserAction as unknown as (a: unknown) => Promise<unknown>)({
      ctx: ctxFor("email"),
      parsedInput: { name: "Jane Doe-Smith" },
    });
    expect(mocks.updateUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "Jane Doe-Smith" })
    );
  });

  test("lets an SSO user submit their unchanged name without erroring", async () => {
    // The form omits untouched fields, but a client echoing the current value back is asking for no
    // change — erroring on that would be a false positive.
    await (updateUserAction as unknown as (a: unknown) => Promise<unknown>)({
      ctx: ctxFor("azuread"),
      parsedInput: { name: "Doe, Jane", locale: "de-DE" },
    });
    expect(mocks.updateUser).toHaveBeenCalledWith("user-1", expect.objectContaining({ locale: "de-DE" }));
  });

  test("still lets an SSO user change their locale", async () => {
    await (updateUserAction as unknown as (a: unknown) => Promise<unknown>)({
      ctx: ctxFor("azuread"),
      parsedInput: { locale: "de-DE" },
    });
    expect(mocks.updateUser).toHaveBeenCalledWith("user-1", { locale: "de-DE" });
  });
});
