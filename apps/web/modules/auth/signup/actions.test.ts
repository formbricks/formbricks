import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { verifyInviteToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { auth } from "@/modules/auth/lib/auth";
import { getInvite } from "@/modules/auth/signup/lib/invite";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { createUserAction } from "./actions";

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    auth: { signup: { interval: 3600, allowedPerInterval: 30, namespace: "auth:signup" } },
  },
}));

// Signup is Better Auth-native (ENG-1054): the credential user + verification email come from
// auth.api.signUpEmail. This suite asserts the invite deep link is threaded into that call.
vi.mock("@/modules/auth/lib/auth", () => ({ auth: { api: { signUpEmail: vi.fn() } } }));
vi.mock("@/lib/user/service", () => ({ getUserByEmail: vi.fn() }));
vi.mock("@/modules/auth/lib/user", () => ({ updateUser: vi.fn() }));
vi.mock("@/lib/jwt", () => ({ verifyInviteToken: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/invite", () => ({ getInvite: vi.fn(), deleteInvite: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/team", () => ({ createTeamMembership: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/utils", () => ({ verifyTurnstileToken: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ createMembership: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ createOrganization: vi.fn(), getOrganization: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn(), groupIdentifyPostHog: vi.fn() }));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: vi.fn() }));
vi.mock("@/modules/ee/mailing/lib/mailing-subscription", () => ({ subscribeUserToMailingList: vi.fn() }));
vi.mock("@/modules/email", () => ({ sendInviteAcceptedEmail: vi.fn() }));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ createWorkspace: vi.fn() }));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    WEBAPP_URL: "http://localhost:3000",
    IS_FORMBRICKS_CLOUD: false,
    IS_TURNSTILE_CONFIGURED: false,
  };
});

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_type: string, _object: string, fn: Function) => fn),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

describe("createUserAction — signup verification email callbackURL", () => {
  const createdUser = {
    id: "user-1",
    email: "ada@example.com",
    name: "Ada",
    locale: "en-US",
    notificationSettings: { alert: {} },
  };

  const baseInput = { name: "Ada", email: "Ada@Example.com", password: "Password123!" };

  const newCtx = () => ({ auditLoggingCtx: { organizationId: "", userId: "" } });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(createdUser as never);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("omits the callbackURL (BA defaults to '/') for a direct, non-invite signup", async () => {
    await createUserAction({ ctx: newCtx(), parsedInput: baseInput } as never);

    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: { email: "ada@example.com", password: "Password123!", name: "Ada", callbackURL: undefined },
    });
  });

  test("bakes the invite deep link into the verification email when an inviteToken is present", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "invite-1", email: "ada@example.com" } as never);
    vi.mocked(getInvite).mockResolvedValue({
      id: "invite-1",
      organizationId: "org-1",
      role: "member",
      teamIds: null,
      creator: { name: "Owner", email: "owner@example.com", locale: "en-US" },
    } as never);

    await createUserAction({
      ctx: newCtx(),
      parsedInput: { ...baseInput, inviteToken: "invite-jwt-123" },
    } as never);

    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: {
        email: "ada@example.com",
        password: "Password123!",
        name: "Ada",
        callbackURL: "http://localhost:3000/invite?token=invite-jwt-123",
      },
    });
  });

  test("treats a duplicate email as already-existed without post-creation side effects", async () => {
    vi.mocked(auth.api.signUpEmail).mockRejectedValue(new Error("user already exists"));
    vi.mocked(getUserByEmail).mockResolvedValue(createdUser as never);

    const result = await createUserAction({ ctx: newCtx(), parsedInput: baseInput } as never);

    expect(result).toEqual({ success: true });
    // already-existed short-circuits handlePostUserCreation + mailing-list subscription.
    expect(subscribeUserToMailingList).not.toHaveBeenCalled();
  });
});
