import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent, identifyPostHogPerson } from "@/lib/posthog";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { updateUser } from "@/modules/auth/lib/user";
import { resolveInviteMatch } from "@/modules/auth/signup/lib/invite";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { ensureDefaultOrganization } from "@/modules/ee/sso/lib/default-organization";
import { getFirstOrganization } from "@/modules/ee/sso/lib/organization";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ user: { findUnique: vi.fn().mockResolvedValue({ notificationSettings: {} }) } })
    ),
    invite: { findUnique: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/authzed/organization-membership", () => ({
  reconcileOrganizationMembership: vi.fn(),
}));
vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));
vi.mock("@/lib/instance/service", () => ({ getIsFreshInstance: vi.fn() }));
vi.mock("@/lib/jwt", () => ({ verifyInviteToken: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ createMembership: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn(), identifyPostHogPerson: vi.fn() }));
vi.mock("@/modules/auth/lib/brevo", () => ({ createBrevoCustomer: vi.fn() }));
vi.mock("@/modules/auth/lib/user", () => ({ updateUser: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/invite", () => ({ resolveInviteMatch: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));
vi.mock("@/modules/ee/sso/lib/default-organization", () => ({ ensureDefaultOrganization: vi.fn() }));
vi.mock("@/modules/ee/sso/lib/organization", () => ({ getFirstOrganization: vi.fn() }));
vi.mock("@/modules/ee/sso/lib/team", () => ({
  getOrganizationByTeamId: vi.fn(),
  createDefaultTeamMembership: vi.fn(),
}));

const constantsOverrides = vi.hoisted(() => ({
  SKIP_INVITE_FOR_SSO: false as boolean,
  DEFAULT_TEAM_ID: "team-123" as string | undefined,
  DEFAULT_ORGANIZATION_ID: undefined as string | undefined,
  IS_FORMBRICKS_CLOUD: false as boolean,
  SIGNUP_DOMAIN_CHECK_ON_INVITES: false as boolean,
  SETUP_TOKEN: undefined as string | undefined,
}));
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get SKIP_INVITE_FOR_SSO() {
      return constantsOverrides.SKIP_INVITE_FOR_SSO;
    },
    get DEFAULT_TEAM_ID() {
      return constantsOverrides.DEFAULT_TEAM_ID;
    },
    get DEFAULT_ORGANIZATION_ID() {
      return constantsOverrides.DEFAULT_ORGANIZATION_ID;
    },
    get IS_FORMBRICKS_CLOUD() {
      return constantsOverrides.IS_FORMBRICKS_CLOUD;
    },
    get SIGNUP_DOMAIN_CHECK_ON_INVITES() {
      return constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES;
    },
    get SETUP_TOKEN() {
      return constantsOverrides.SETUP_TOKEN;
    },
  };
});

const mockOrg = { id: "org-1" } as never;
// AuthZed projections report a failure as a status; they do not throw.
const projected = { status: "projected", passes: 1 } as const;
const projectionFailed = {
  status: "failed",
  attempts: 1,
  code: "authzed_unavailable",
  retryable: true,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  constantsOverrides.SKIP_INVITE_FOR_SSO = false;
  constantsOverrides.DEFAULT_TEAM_ID = "team-123";
  constantsOverrides.DEFAULT_ORGANIZATION_ID = undefined;
  constantsOverrides.IS_FORMBRICKS_CLOUD = false;
  constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = false;
  constantsOverrides.SETUP_TOKEN = undefined;
  // Defaults: established single-org instance, access allowed, orgs resolvable.
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  vi.mocked(getAccessControlPermission).mockResolvedValue(true);
  vi.mocked(getFirstOrganization).mockResolvedValue(mockOrg);
  vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrg);
  vi.mocked(ensureDefaultOrganization).mockResolvedValue({ organizationId: "default-org", role: "manager" });
  // clearAllMocks keeps implementations, so reset the one tests override with rejections.
  vi.mocked(createMembership).mockReset();
  vi.mocked(reconcileOrganizationMembership).mockReset().mockResolvedValue(projected);
  vi.mocked(reconcileTeamWorkspaceRelationships).mockReset().mockResolvedValue(projected);
  vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);
  vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "inv-1", email: "a@b.com" });
});

describe("gateSsoProvisioning — bypass branches", () => {
  // ENG-2247: fresh AND single-org, so freshness is what admits this sign-up — the row carries the
  // single-use bootstrap marker, and a second concurrent SSO sign-up loses on the unique index.
  test("fresh instance bypasses all gates, assigns no org, and marks the bootstrap admin", async () => {
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "provision",
      isBootstrapAdmin: true,
      wasFreshInstance: true,
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });

  // ENG-7313: a fresh instance under a multi-org licence is still fresh, so the first SSO user must
  // record setup even though `admitsAsBootstrapAdmin` is false there.
  test("a fresh multi-org instance carries wasFreshInstance without the bootstrap marker", async () => {
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);

    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "provision",
      isBootstrapAdmin: false,
      wasFreshInstance: true,
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });

  // ENG-2247: multi-org admits everyone through this branch, so freshness is incidental and the marker
  // must NOT be stamped — doing so would make the second SSO account ever created fail on the index.
  test("multi-org bypasses all gates and assigns no org, without marking a bootstrap admin", async () => {
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "provision",
      isBootstrapAdmin: false,
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });

  // ENG-7313: the DEFAULT_ORGANIZATION_ID route would create that organization with the first IdP account
  // as owner, so on a fresh instance with SETUP_TOKEN set it is refused like every other SSO claim.
  test("SETUP_TOKEN also blocks the DEFAULT_ORGANIZATION_ID route on a fresh instance", async () => {
    constantsOverrides.SETUP_TOKEN = "0123456789abcdef-setup-token";
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "org-default";
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);

    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "reject",
      reason: "no_organization_found",
    });
  });

  test("DEFAULT_ORGANIZATION_ID still provisions once the instance is set up, with SETUP_TOKEN set", async () => {
    constantsOverrides.SETUP_TOKEN = "0123456789abcdef-setup-token";
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "org-default";

    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toMatchObject({
      action: "provision",
      organizationId: "org-default",
    });
  });

  // ENG-7313: SSO has no form to carry the setup token, so with one configured the SSO route is not a
  // way to claim a fresh instance. The user sees "no organization"; the log names the real cause.
  test("a fresh instance with SETUP_TOKEN configured is not claimable through SSO", async () => {
    constantsOverrides.SETUP_TOKEN = "0123456789abcdef-setup-token";
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);

    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "reject",
      reason: "no_organization_found",
    });
    expect(getIsFreshInstance).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { reason: "setup_token_required" },
      expect.stringContaining("SETUP_TOKEN is set")
    );
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(constantsOverrides.SETUP_TOKEN);
  });
});

describe("gateSsoProvisioning — DEFAULT_ORGANIZATION_ID (ENG-2089)", () => {
  test("provisions into the configured org without an invite, deferring creation to the write phase", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    constantsOverrides.SKIP_INVITE_FOR_SSO = false;
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "provision",
      organizationId: "default-org",
      assignToDefaultTeam: false,
      signupSource: "direct",
      useDefaultOrganization: true,
    });
    // No invite was consulted, and no org was resolved from the database — that is the whole point of
    // the env var, and what regressed: without it these gates rejected the sign-up.
    expect(resolveInviteMatch).not.toHaveBeenCalled();
    expect(getFirstOrganization).not.toHaveBeenCalled();
  });

  test("wins over multi-org, which would otherwise assign no org at all", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" });
    expect(decision).toMatchObject({ action: "provision", organizationId: "default-org" });
  });

  test("wins over a fresh instance, which would otherwise assign no org at all", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" });
    expect(decision).toMatchObject({
      action: "provision",
      organizationId: "default-org",
      wasFreshInstance: true,
    });
  });

  test("does not also join DEFAULT_TEAM_ID's team, which may belong to another org", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    constantsOverrides.SKIP_INVITE_FOR_SSO = true;
    constantsOverrides.DEFAULT_TEAM_ID = "team-123";
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" });
    expect(decision).toMatchObject({ assignToDefaultTeam: false });
  });

  test("carries the invite signup source when the callback URL has a token", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    const decision = await gateSsoProvisioning({
      email: "a@b.com",
      callbackUrl: "/auth/signup?token=abc",
    });
    expect(decision).toMatchObject({ signupSource: "invite" });
  });
});

describe("gateSsoProvisioning — rejects", () => {
  test("skip-invite without DEFAULT_TEAM_ID is rejected", async () => {
    constantsOverrides.SKIP_INVITE_FOR_SSO = true;
    constantsOverrides.DEFAULT_TEAM_ID = undefined;
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "reject",
      reason: "missing_default_team_id",
    });
  });

  test("invite required but missing callback URL is rejected", async () => {
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "reject",
      reason: "missing_callback_url",
    });
  });

  test("signin source without an invite token is rejected", async () => {
    expect(
      await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?source=signin" })
    ).toEqual({ action: "reject", reason: "signin_without_invite_token" });
  });

  test("invite token email mismatch is rejected", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("email_mismatch");
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" })).toEqual(
      { action: "reject", reason: "invite_email_mismatch" }
    );
  });

  test("invalid/expired invite token is rejected", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("invalid_or_expired");
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" })).toEqual(
      { action: "reject", reason: "invalid_invite_token" }
    );
  });

  test("a callback URL without a token is rejected", async () => {
    // "not-a-url" resolves against WEBAPP_URL to a tokenless URL → resolveInviteMatch sees no token.
    vi.mocked(resolveInviteMatch).mockResolvedValue("missing");
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "not-a-url" })).toEqual({
      action: "reject",
      reason: "invite_token_validation_error",
    });
  });

  test("an unverifiable invite token is rejected", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("verification_error");
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" })).toEqual(
      { action: "reject", reason: "invite_token_validation_error" }
    );
  });

  test("no resolvable organization is rejected", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    vi.mocked(getFirstOrganization).mockResolvedValue(null);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" })).toEqual(
      { action: "reject", reason: "no_organization_found" }
    );
  });

  test("access control denied without a callback URL is rejected", async () => {
    constantsOverrides.SKIP_INVITE_FOR_SSO = true; // skip-invite path reaches org resolution with empty callbackUrl
    constantsOverrides.DEFAULT_TEAM_ID = "team-123";
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "reject",
      reason: "insufficient_role_permissions",
    });
  });
});

describe("gateSsoProvisioning — provisions", () => {
  test("skip-invite with DEFAULT_TEAM_ID provisions into the default team's org", async () => {
    constantsOverrides.SKIP_INVITE_FOR_SSO = true;
    constantsOverrides.DEFAULT_TEAM_ID = "team-123";
    const result = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" });
    expect(getOrganizationByTeamId).toHaveBeenCalledWith("team-123");
    expect(getFirstOrganization).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: "provision",
      organizationId: "org-1",
      assignToDefaultTeam: true,
      signupSource: "direct",
    });
  });

  test("a valid invite provisions into the first org with invite source", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    const result = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" });
    expect(getFirstOrganization).toHaveBeenCalled();
    expect(result).toEqual({
      action: "provision",
      organizationId: "org-1",
      assignToDefaultTeam: false,
      signupSource: "invite",
    });
  });
});

// ENG-7097: the invite's role reaches the write phase only through a valid invite token, never through
// an email match, because the IdP may assert an email it does not vouch for.
describe("gateSsoProvisioning — invite role", () => {
  const inviteCallback = "/invite?token=tok";

  test("carries the role of the invite whose token the callback URL holds", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      role: "manager",
      organizationId: "org-1",
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    const decision = await gateSsoProvisioning({ email: "A@b.com", callbackUrl: inviteCallback });
    expect(verifyInviteToken).toHaveBeenCalledWith("tok");
    expect(prisma.invite.findUnique).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      select: { role: true, organizationId: true, expiresAt: true },
    });
    expect(decision).toMatchObject({ action: "provision", organizationId: "org-1", inviteRole: "manager" });
  });

  test("ignores an invite that belongs to another organization", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      role: "owner",
      organizationId: "other-org",
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback });
    expect(decision).toMatchObject({ action: "provision" });
    expect(decision).not.toHaveProperty("inviteRole");
  });

  test("ignores an expired invite", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      role: "owner",
      organizationId: "org-1",
      expiresAt: new Date(Date.now() - 60_000),
    } as never);
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback });
    expect(decision).not.toHaveProperty("inviteRole");
  });

  test("ignores a token issued for another email", async () => {
    constantsOverrides.SKIP_INVITE_FOR_SSO = true;
    vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "inv-1", email: "someone@else.com" });
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback });
    expect(decision).toMatchObject({ action: "provision" });
    expect(decision).not.toHaveProperty("inviteRole");
    expect(prisma.invite.findUnique).not.toHaveBeenCalled();
  });

  test("keeps the default role and still provisions when the token cannot be read", async () => {
    constantsOverrides.SKIP_INVITE_FOR_SSO = true;
    vi.mocked(verifyInviteToken).mockImplementation(() => {
      throw new Error("bad token");
    });
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback });
    expect(decision).toMatchObject({ action: "provision" });
    expect(decision).not.toHaveProperty("inviteRole");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ errName: expect.any(String) }),
      "SSO provisioning: could not read the sign-up's invite token"
    );
  });

  // A valid billing invite must not land as member just because the lookup failed: the invite page
  // keeps an existing role, so nothing would correct it later. Rejecting lets the user sign in again.
  test("rejects the sign-up when the invite cannot be looked up", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    vi.mocked(prisma.invite.findUnique).mockRejectedValue(new Error("db down"));
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback })).toEqual({
      action: "reject",
      reason: "invite_token_validation_error",
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: expect.any(String) }),
      "SSO provisioning: could not look up the sign-up's invite"
    );
  });

  test("rejects the sign-up when the invite cannot be looked up with DEFAULT_ORGANIZATION_ID set", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    vi.mocked(prisma.invite.findUnique).mockRejectedValue(new Error("db down"));
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback })).toEqual({
      action: "reject",
      reason: "invite_token_validation_error",
    });
  });

  test("carries a valid billing invite's role", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      role: "billing",
      organizationId: "org-1",
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback });
    expect(decision).toMatchObject({ action: "provision", inviteRole: "billing" });
  });

  // The reported escalation: an identity whose email the IdP does not vouch for, signing up without
  // an invite link while an owner invite for that email is pending, used to become owner.
  test("grants no invite role without a token, even with DEFAULT_ORGANIZATION_ID set", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" });
    expect(decision).not.toHaveProperty("inviteRole");
    expect(prisma.invite.findUnique).not.toHaveBeenCalled();
  });

  test("carries a valid invite's role with DEFAULT_ORGANIZATION_ID set", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      role: "manager",
      organizationId: "default-org",
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    const decision = await gateSsoProvisioning({ email: "a@b.com", callbackUrl: inviteCallback });
    expect(decision).toMatchObject({ useDefaultOrganization: true, inviteRole: "manager" });
  });
});

describe("gateSsoProvisioning — personal email domain block (Cloud)", () => {
  const blockedEmail = "spammer@gmail.com";

  test("rejects a personal-domain SSO sign-up even when multi-org would otherwise bypass the gate", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true); // the check must run BEFORE this bypass
    expect(await gateSsoProvisioning({ email: blockedEmail, callbackUrl: "" })).toEqual({
      action: "reject",
      reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
    });
  });

  test("rejects a personal-domain SSO sign-up on a fresh instance too", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: blockedEmail, callbackUrl: "" })).toEqual({
      action: "reject",
      reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
    });
  });

  test("exempts a personal-domain sign-up backed by a valid matching invite", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
    expect(
      await gateSsoProvisioning({ email: blockedEmail, callbackUrl: "https://app.test/?token=t" })
    ).toEqual({
      action: "provision",
      organizationId: "org-1",
      assignToDefaultTeam: false,
      signupSource: "invite",
    });
  });

  test("blocks a personal-domain invite when SIGNUP_DOMAIN_CHECK_ON_INVITES is enabled", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
    constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = true;
    // Kill-switch on: the invite exemption isn't consulted, so resolveInviteMatch is irrelevant.
    expect(
      await gateSsoProvisioning({ email: blockedEmail, callbackUrl: "https://app.test/?token=t" })
    ).toEqual({ action: "reject", reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE });
  });

  test("does not block a personal domain when not on Formbricks Cloud (self-hosted)", async () => {
    // IS_FORMBRICKS_CLOUD stays false (default); fresh instance so it provisions cleanly.
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: blockedEmail, callbackUrl: "" })).toEqual({
      action: "provision",
      isBootstrapAdmin: true,
      wasFreshInstance: true,
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });

  test("allows a company-domain SSO sign-up on Cloud", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: "person@acme-corp.com", callbackUrl: "" })).toEqual({
      action: "provision",
      isBootstrapAdmin: false,
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });
});

describe("provisionSsoUserMemberships", () => {
  const baseArgs = {
    userId: "u1",
    email: "new@example.com",
    provider: "google",
    organizationId: "org-1" as string | null,
    assignToDefaultTeam: false,
    signupSource: "direct",
  } as Parameters<typeof provisionSsoUserMemberships>[0];

  test("assigns the user to the org, unsubscribes from org alerts, and syncs analytics", async () => {
    await provisionSsoUserMemberships(baseArgs);
    expect(createMembership).toHaveBeenCalledWith(
      "org-1",
      "u1",
      { role: "member", accepted: true },
      expect.objectContaining({ projection: "deferred", transaction: expect.anything() })
    );
    expect(reconcileOrganizationMembership).toHaveBeenCalledWith("org-1", "u1");
    expect(createDefaultTeamMembership).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith(
      "u1",
      { notificationSettings: { alert: {}, unsubscribedOrganizationIds: ["org-1"] } },
      expect.anything()
    );
    expect(createBrevoCustomer).toHaveBeenCalledWith({ id: "u1", email: "new@example.com" });
    expect(identifyPostHogPerson).toHaveBeenCalledWith("u1", { email: "new@example.com", name: undefined });
    expect(capturePostHogEvent).toHaveBeenCalledWith("u1", "user_signed_up", {
      auth_provider: "google",
      email_domain: "example.com",
      signup_source: "direct",
      invite_organization_id: "org-1",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  // ENG-7097: the invite page no longer changes an existing member's role, so an SSO sign-up from an
  // invite link has to get the invite's role here.
  test("gives the new member the gate's token-validated invite role", async () => {
    await provisionSsoUserMemberships({ ...baseArgs, signupSource: "invite", inviteRole: "manager" });
    expect(createMembership).toHaveBeenCalledWith(
      "org-1",
      "u1",
      { role: "manager", accepted: true },
      expect.anything()
    );
  });

  test("lets an invite set a restricted role on the ordinary path, where member is only a default", async () => {
    await provisionSsoUserMemberships({ ...baseArgs, signupSource: "invite", inviteRole: "billing" });
    expect(createMembership).toHaveBeenCalledWith(
      "org-1",
      "u1",
      { role: "billing", accepted: true },
      expect.anything()
    );
  });

  describe("useDefaultOrganization (ENG-2089)", () => {
    const defaultOrgArgs = {
      ...baseArgs,
      name: "Ada",
      organizationId: "default-org",
      useDefaultOrganization: true,
    } as Parameters<typeof provisionSsoUserMemberships>[0];

    test("uses the role ensureDefaultOrganization resolved instead of the hardcoded member", async () => {
      vi.mocked(ensureDefaultOrganization).mockResolvedValue({
        organizationId: "default-org",
        role: "manager",
      });
      await provisionSsoUserMemberships(defaultOrgArgs);
      expect(ensureDefaultOrganization).toHaveBeenCalledWith("Ada");
      expect(createMembership).toHaveBeenCalledWith(
        "default-org",
        "u1",
        { role: "manager", accepted: true },
        expect.anything()
      );
      expect(reconcileOrganizationMembership).toHaveBeenCalledWith("default-org", "u1");
    });

    test("makes the sign-up that created the org its owner", async () => {
      vi.mocked(ensureDefaultOrganization).mockResolvedValue({
        organizationId: "default-org",
        role: "owner",
      });
      await provisionSsoUserMemberships(defaultOrgArgs);
      expect(createMembership).toHaveBeenCalledWith(
        "default-org",
        "u1",
        { role: "owner", accepted: true },
        expect.anything()
      );
    });

    // ENG-7097: the configured role is the operator's floor; an invite may raise it, never lower it.
    test("keeps the configured role when the invite's role is lower", async () => {
      vi.mocked(ensureDefaultOrganization).mockResolvedValue({
        organizationId: "default-org",
        role: "manager",
      });
      await provisionSsoUserMemberships({ ...defaultOrgArgs, inviteRole: "member" });
      expect(createMembership).toHaveBeenCalledWith(
        "default-org",
        "u1",
        { role: "manager", accepted: true },
        expect.anything()
      );
    });

    test("raises the configured role to the invite's when the invite's is higher", async () => {
      vi.mocked(ensureDefaultOrganization).mockResolvedValue({
        organizationId: "default-org",
        role: "member",
      });
      await provisionSsoUserMemberships({ ...defaultOrgArgs, inviteRole: "owner" });
      expect(createMembership).toHaveBeenCalledWith(
        "default-org",
        "u1",
        { role: "owner", accepted: true },
        expect.anything()
      );
    });

    test("falls back to the email local part when the IdP gave no name", async () => {
      await provisionSsoUserMemberships({ ...defaultOrgArgs, name: null });
      expect(ensureDefaultOrganization).toHaveBeenCalledWith("new");
    });

    test("skips the org writes but still syncs analytics when the org cannot be resolved", async () => {
      vi.mocked(ensureDefaultOrganization).mockResolvedValue(null);
      await provisionSsoUserMemberships(defaultOrgArgs);
      expect(createMembership).not.toHaveBeenCalled();
      expect(reconcileOrganizationMembership).not.toHaveBeenCalled();
      expect(createBrevoCustomer).toHaveBeenCalledWith({ id: "u1", email: "new@example.com" });
      expect(capturePostHogEvent).toHaveBeenCalledWith(
        "u1",
        "user_signed_up",
        expect.objectContaining({ invite_organization_id: null })
      );
    });

    test("is not consulted on the ordinary path, which still assigns member", async () => {
      await provisionSsoUserMemberships(baseArgs);
      expect(ensureDefaultOrganization).not.toHaveBeenCalled();
      expect(createMembership).toHaveBeenCalledWith(
        "org-1",
        "u1",
        { role: "member", accepted: true },
        expect.anything()
      );
    });
  });

  test("creates a default team membership when requested", async () => {
    await provisionSsoUserMemberships({ ...baseArgs, assignToDefaultTeam: true });
    expect(createDefaultTeamMembership).toHaveBeenCalledWith("u1", expect.anything());
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [{ teamId: "team-123", userId: "u1" }],
    });
  });

  test("skips org writes when there is no organization but still syncs analytics", async () => {
    await provisionSsoUserMemberships({ ...baseArgs, organizationId: null });
    expect(createMembership).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(createBrevoCustomer).toHaveBeenCalledWith({ id: "u1", email: "new@example.com" });
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "u1",
      "user_signed_up",
      expect.objectContaining({ invite_organization_id: null })
    );
  });

  test("logs (does not throw) when assignment fails on every attempt, and still syncs analytics", async () => {
    vi.mocked(createMembership).mockRejectedValue(new Error("db down"));
    await expect(provisionSsoUserMemberships(baseArgs)).resolves.toBeUndefined();
    expect(createMembership).toHaveBeenCalledTimes(2); // initial + one retry
    expect(reconcileOrganizationMembership).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(createBrevoCustomer).toHaveBeenCalled();
    expect(capturePostHogEvent).toHaveBeenCalled();
  });

  test("retries once and succeeds without logging an error", async () => {
    vi.mocked(createMembership)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue(undefined as never);
    await provisionSsoUserMemberships(baseArgs);
    expect(createMembership).toHaveBeenCalledTimes(2);
    expect(reconcileOrganizationMembership).toHaveBeenCalledWith("org-1", "u1");
    expect(logger.error).not.toHaveBeenCalled();
  });

  // ENG-7097: once the membership is committed, a retry must not write the role again, or it would
  // undo a role change an administrator made between the attempts.
  test("retries only the projection when it fails after the membership committed", async () => {
    vi.mocked(createMembership).mockResolvedValue(undefined as never);
    vi.mocked(reconcileOrganizationMembership).mockResolvedValueOnce(projectionFailed);
    await provisionSsoUserMemberships(baseArgs);
    expect(createMembership).toHaveBeenCalledTimes(1);
    expect(reconcileOrganizationMembership).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("logs once when the projection fails on every attempt, without rewriting the membership", async () => {
    vi.mocked(createMembership).mockResolvedValue(undefined as never);
    vi.mocked(reconcileOrganizationMembership).mockResolvedValue(projectionFailed);
    await expect(provisionSsoUserMemberships(baseArgs)).resolves.toBeUndefined();
    expect(createMembership).toHaveBeenCalledTimes(1);
    expect(reconcileOrganizationMembership).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: expect.any(String) }),
      "SSO provisioning: failed to project new SSO user's organization membership"
    );
  });

  test("retries when the default-team projection reports a failure", async () => {
    vi.mocked(createMembership).mockResolvedValue(undefined as never);
    vi.mocked(reconcileTeamWorkspaceRelationships).mockResolvedValueOnce(projectionFailed);
    await provisionSsoUserMemberships({ ...baseArgs, assignToDefaultTeam: true });
    expect(createMembership).toHaveBeenCalledTimes(1);
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("preserves existing alert settings and dedups the org in unsubscribedOrganizationIds", async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce((async (cb: (tx: unknown) => unknown) =>
      cb({
        user: {
          findUnique: vi.fn().mockResolvedValue({
            notificationSettings: {
              alert: { weeklySummary: true },
              unsubscribedOrganizationIds: ["org-1", "org-2"],
            },
          }),
        },
      })) as never);
    await provisionSsoUserMemberships(baseArgs); // baseArgs.organizationId === "org-1"
    expect(updateUser).toHaveBeenCalledWith(
      "u1",
      {
        notificationSettings: {
          alert: { weeklySummary: true },
          unsubscribedOrganizationIds: ["org-1", "org-2"], // org-1 deduped, org-2 + alert preserved
        },
      },
      expect.anything()
    );
  });
});
