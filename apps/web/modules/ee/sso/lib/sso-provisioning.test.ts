import { beforeEach, describe, expect, test, vi } from "vitest";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getFirstOrganization } from "@/modules/ee/sso/lib/organization";
import { getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";
import { gateSsoProvisioning } from "./sso-provisioning";

vi.mock("@/lib/instance/service", () => ({ getIsFreshInstance: vi.fn() }));
vi.mock("@/lib/jwt", () => ({ verifyInviteToken: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/invite", () => ({ getIsValidInviteToken: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));
vi.mock("@/modules/ee/sso/lib/organization", () => ({ getFirstOrganization: vi.fn() }));
vi.mock("@/modules/ee/sso/lib/team", () => ({ getOrganizationByTeamId: vi.fn() }));

const constantsOverrides = vi.hoisted(() => ({
  SKIP_INVITE_FOR_SSO: false as boolean,
  DEFAULT_TEAM_ID: "team-123" as string | undefined,
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
  };
});

const mockOrg = { id: "org-1" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  constantsOverrides.SKIP_INVITE_FOR_SSO = false;
  constantsOverrides.DEFAULT_TEAM_ID = "team-123";
  // Defaults: established single-org instance, access allowed, orgs resolvable.
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  vi.mocked(getAccessControlPermission).mockResolvedValue(true);
  vi.mocked(getFirstOrganization).mockResolvedValue(mockOrg);
  vi.mocked(getOrganizationByTeamId).mockResolvedValue(mockOrg);
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
