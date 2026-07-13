import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { verifyInviteToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { auth } from "@/modules/auth/lib/auth";
import { getInvite, resolveInviteMatch } from "@/modules/auth/signup/lib/invite";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { createUserAction } from "./actions";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

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
vi.mock("@/modules/auth/signup/lib/invite", () => ({
  getInvite: vi.fn(),
  deleteInvite: vi.fn(),
  resolveInviteMatch: vi.fn(),
}));
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

// Getters so individual tests can flip the Cloud gate / invite kill-switch at runtime. The real
// signup-email-domain utility reads these through live bindings; only the constants are mocked.
const constantsOverrides = vi.hoisted(() => ({
  IS_FORMBRICKS_CLOUD: false,
  SIGNUP_DOMAIN_CHECK_ON_INVITES: false,
}));

vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "http://localhost:3000",
  IS_TURNSTILE_CONFIGURED: false,
  TURNSTILE_SECRET_KEY: undefined,
  get IS_FORMBRICKS_CLOUD() {
    return constantsOverrides.IS_FORMBRICKS_CLOUD;
  },
  get SIGNUP_DOMAIN_CHECK_ON_INVITES() {
    return constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES;
  },
}));

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
    constantsOverrides.IS_FORMBRICKS_CLOUD = false;
    constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = false;
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

  test("does not point the verification callback at /invite for invite signups (ENG-1527)", async () => {
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

    // The invite is accepted + deleted during signup, so a /invite callback would render "Invite Not
    // Found" once the verification link is clicked. signUpEmail is called with no callbackURL (Better
    // Auth defaults it to "/"), landing the verified, already-provisioned user on the app home.
    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: {
        email: "ada@example.com",
        password: "Password123!",
        name: "Ada",
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

describe("createUserAction — personal email domain block (Cloud)", () => {
  const createdUser = {
    id: "user-2",
    email: "spammer@gmail.com",
    name: "Spammer",
    locale: "en-US",
    notificationSettings: { alert: {} },
  };
  const blockedInput = { name: "Spammer", email: "spammer@gmail.com", password: "Password123!" };
  const newCtx = () => ({ auditLoggingCtx: { organizationId: "", userId: "" } });

  beforeEach(() => {
    vi.resetAllMocks();
    constantsOverrides.IS_FORMBRICKS_CLOUD = true; // this suite runs as Formbricks Cloud
    constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = false;
    vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(createdUser as never);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("blocks a personal-domain signup and creates no user", async () => {
    await expect(createUserAction({ ctx: newCtx(), parsedInput: blockedInput } as never)).rejects.toThrow(
      SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE
    );
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("allows a personal-domain signup backed by a valid matching invite", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid"); // domain-block exemption
    // handleInviteAcceptance (post-signup) still verifies + loads the invite.
    vi.mocked(verifyInviteToken).mockReturnValue({
      inviteId: "invite-1",
      email: "spammer@gmail.com",
    } as never);
    vi.mocked(getInvite).mockResolvedValue({
      id: "invite-1",
      organizationId: "org-1",
      role: "member",
      teamIds: null,
      creator: { name: "Owner", email: "owner@acme-corp.com", locale: "en-US" },
    } as never);

    const result = await createUserAction({
      ctx: newCtx(),
      parsedInput: { ...blockedInput, inviteToken: "invite-jwt-123" },
    } as never);

    expect(result).toEqual({ success: true });
    expect(auth.api.signUpEmail).toHaveBeenCalled();
  });

  test("blocks when the invite email does not match the signup email", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("email_mismatch");

    await expect(
      createUserAction({
        ctx: newCtx(),
        parsedInput: { ...blockedInput, inviteToken: "invite-jwt-123" },
      } as never)
    ).rejects.toThrow(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("blocks a personal-domain invite when the kill-switch is enabled", async () => {
    constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = true;
    // Kill-switch on: the invite exemption isn't consulted at all, so resolveInviteMatch is irrelevant.

    await expect(
      createUserAction({
        ctx: newCtx(),
        parsedInput: { ...blockedInput, inviteToken: "invite-jwt-123" },
      } as never)
    ).rejects.toThrow(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("allows a company-domain signup", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({ ...createdUser, email: "person@acme-corp.com" } as never);

    const result = await createUserAction({
      ctx: newCtx(),
      parsedInput: { name: "Person", email: "person@acme-corp.com", password: "Password123!" },
    } as never);

    expect(result).toEqual({ success: true });
    expect(auth.api.signUpEmail).toHaveBeenCalled();
  });
});
