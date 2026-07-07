import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { updateUser } from "@/modules/auth/lib/user";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getFirstOrganization } from "@/modules/ee/sso/lib/organization";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ user: { findUnique: vi.fn().mockResolvedValue({ notificationSettings: {} }) } })
    ),
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/instance/service", () => ({ getIsFreshInstance: vi.fn() }));
vi.mock("@/lib/jwt", () => ({ verifyInviteToken: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ createMembership: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/auth/lib/brevo", () => ({ createBrevoCustomer: vi.fn() }));
vi.mock("@/modules/auth/lib/user", () => ({ updateUser: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/invite", () => ({ getIsValidInviteToken: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));
vi.mock("@/modules/ee/sso/lib/organization", () => ({ getFirstOrganization: vi.fn() }));
vi.mock("@/modules/ee/sso/lib/team", () => ({
  getOrganizationByTeamId: vi.fn(),
  createDefaultTeamMembership: vi.fn(),
}));

const constantsOverrides = vi.hoisted(() => ({
  SKIP_INVITE_FOR_SSO: false as boolean,
  DEFAULT_TEAM_ID: "team-123" as string | undefined,
  IS_FORMBRICKS_CLOUD: false as boolean,
  SIGNUP_DOMAIN_CHECK_ON_INVITES: false as boolean,
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
    get IS_FORMBRICKS_CLOUD() {
      return constantsOverrides.IS_FORMBRICKS_CLOUD;
    },
    get SIGNUP_DOMAIN_CHECK_ON_INVITES() {
      return constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES;
    },
  };
});

const mockOrg = { id: "org-1" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  constantsOverrides.SKIP_INVITE_FOR_SSO = false;
  constantsOverrides.DEFAULT_TEAM_ID = "team-123";
  constantsOverrides.IS_FORMBRICKS_CLOUD = false;
  constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = false;
  // Defaults: established single-org instance, access allowed, orgs resolvable.
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  vi.mocked(getAccessControlPermission).mockResolvedValue(true);
  vi.mocked(getFirstOrganization).mockResolvedValue(mockOrg);
  vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrg);
  // clearAllMocks keeps implementations, so reset the one tests override with rejections.
  vi.mocked(createMembership).mockReset();
});

describe("gateSsoProvisioning — bypass branches", () => {
  test("fresh instance bypasses all gates and assigns no org", async () => {
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "provision",
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });

  test("multi-org bypasses all gates and assigns no org", async () => {
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "" })).toEqual({
      action: "provision",
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
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

  test("invite token email mismatch is rejected (without checking validity)", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue({ email: "other@b.com", inviteId: "inv-1" } as never);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" })).toEqual(
      { action: "reject", reason: "invite_email_mismatch" }
    );
    expect(getIsValidInviteToken).not.toHaveBeenCalled();
  });

  test("invalid/expired invite token is rejected", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue({ email: "a@b.com", inviteId: "inv-1" } as never);
    vi.mocked(getIsValidInviteToken).mockResolvedValue(false);
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" })).toEqual(
      { action: "reject", reason: "invalid_invite_token" }
    );
  });

  test("malformed callback URL is rejected", async () => {
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "not-a-url" })).toEqual({
      action: "reject",
      reason: "invite_token_validation_error",
    });
  });

  test("a throwing invite verification is rejected", async () => {
    vi.mocked(verifyInviteToken).mockImplementation(() => {
      throw new Error("bad token");
    });
    expect(await gateSsoProvisioning({ email: "a@b.com", callbackUrl: "https://app.test/?token=t" })).toEqual(
      { action: "reject", reason: "invite_token_validation_error" }
    );
  });

  test("no resolvable organization is rejected", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue({ email: "a@b.com", inviteId: "inv-1" } as never);
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);
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
    vi.mocked(verifyInviteToken).mockReturnValue({ email: "a@b.com", inviteId: "inv-1" } as never);
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);
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
    vi.mocked(verifyInviteToken).mockReturnValue({ email: blockedEmail, inviteId: "inv-1" } as never);
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);
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
    vi.mocked(verifyInviteToken).mockReturnValue({ email: blockedEmail, inviteId: "inv-1" } as never);
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);
    expect(
      await gateSsoProvisioning({ email: blockedEmail, callbackUrl: "https://app.test/?token=t" })
    ).toEqual({ action: "reject", reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE });
  });

  test("does not block a personal domain when not on Formbricks Cloud (self-hosted)", async () => {
    // IS_FORMBRICKS_CLOUD stays false (default); fresh instance so it provisions cleanly.
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);
    expect(await gateSsoProvisioning({ email: blockedEmail, callbackUrl: "" })).toEqual({
      action: "provision",
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
      expect.anything()
    );
    expect(createDefaultTeamMembership).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith(
      "u1",
      { notificationSettings: { alert: {}, unsubscribedOrganizationIds: ["org-1"] } },
      expect.anything()
    );
    expect(createBrevoCustomer).toHaveBeenCalledWith({ id: "u1", email: "new@example.com" });
    expect(capturePostHogEvent).toHaveBeenCalledWith("u1", "user_signed_up", {
      auth_provider: "google",
      email_domain: "example.com",
      signup_source: "direct",
      invite_organization_id: "org-1",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("creates a default team membership when requested", async () => {
    await provisionSsoUserMemberships({ ...baseArgs, assignToDefaultTeam: true });
    expect(createDefaultTeamMembership).toHaveBeenCalledWith("u1", expect.anything());
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
