import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { FB_LOGO_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getIsMultiOrgEnabled, getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import { EmailCustomizationSettings } from "@/modules/ee/whitelabel/email-customization/components/email-customization-settings";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { getTranslate } from "@/tolgee/server";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { DeleteOrganization } from "./components/DeleteOrganization";
import { EditOrganizationNameForm } from "./components/EditOrganizationNameForm";
import Page from "./page";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_PRODUCTION: false,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "mock-github-secret",
  GOOGLE_CLIENT_ID: "mock-google-client-id",
  GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  SAML_DATABASE_URL: "mock-saml-database-url",
  WEBAPP_URL: "mock-webapp-url",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
  getWhiteLabelPermission: vi.fn(),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar",
  () => ({
    OrganizationSettingsNavbar: vi.fn(() => <div>OrganizationSettingsNavbar</div>),
  })
);

vi.mock("./components/EditOrganizationNameForm", () => ({
  EditOrganizationNameForm: vi.fn(() => <div>EditOrganizationNameForm</div>),
}));

vi.mock("@/modules/ee/whitelabel/email-customization/components/email-customization-settings", () => ({
  EmailCustomizationSettings: vi.fn(() => <div>EmailCustomizationSettings</div>),
}));

vi.mock("./components/DeleteOrganization", () => ({
  DeleteOrganization: vi.fn(() => <div>DeleteOrganization</div>),
}));

vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: vi.fn(() => <div>IdBadge</div>),
}));

describe("Page", () => {
  afterEach(() => {
    cleanup();
  });

  let mockEnvironmentAuth = {
    session: { user: { id: "test-user-id" } },
    currentUserMembership: { role: "owner" },
    organization: { id: "test-organization-id", billing: { plan: "free" } },
    isOwner: true,
    isManager: false,
  } as unknown as TEnvironmentAuth;

  const mockUser = { id: "test-user-id" } as TUser;
  const mockTranslate = vi.fn((key) => key);
  const mockParams = { environmentId: "env-123" };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getEnvironmentAuth).mockResolvedValue(mockEnvironmentAuth);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getWhiteLabelPermission).mockResolvedValue(true);
  });

  test("renders the page with organization settings for owner", async () => {
    const props = {
      params: Promise.resolve(mockParams),
    };

    const PageComponent = await Page(props);
    render(PageComponent);

    expect(screen.getByText("environments.settings.general.organization_settings")).toBeInTheDocument();
    expect(OrganizationSettingsNavbar).toHaveBeenCalledWith(
      {
        environmentId: mockParams.environmentId,
        isFormbricksCloud: IS_FORMBRICKS_CLOUD,
        membershipRole: "owner",
        activeId: "general",
      },
      undefined
    );
    expect(screen.getByText("environments.settings.general.organization_name")).toBeInTheDocument();
    expect(EditOrganizationNameForm).toHaveBeenCalledWith(
      {
        organization: mockEnvironmentAuth.organization,
        environmentId: mockParams.environmentId,
        membershipRole: "owner",
      },
      undefined
    );
    expect(EmailCustomizationSettings).toHaveBeenCalledWith(
      {
        organization: mockEnvironmentAuth.organization,
        hasWhiteLabelPermission: true,
        environmentId: mockParams.environmentId,
        isReadOnly: false,
        isFormbricksCloud: IS_FORMBRICKS_CLOUD,
        fbLogoUrl: FB_LOGO_URL,
        user: mockUser,
      },
      undefined
    );
    expect(screen.getByText("environments.settings.general.delete_organization")).toBeInTheDocument();
    expect(DeleteOrganization).toHaveBeenCalledWith(
      {
        organization: mockEnvironmentAuth.organization,
        isDeleteDisabled: false,
        isUserOwner: true,
      },
      undefined
    );
    expect(IdBadge).toHaveBeenCalledWith(
      {
        id: mockEnvironmentAuth.organization.id,
        label: "common.organization_id",
        variant: "column",
      },
      undefined
    );
  });

  test("renders correctly when user is manager", async () => {
    const managerAuth = {
      ...mockEnvironmentAuth,
      currentUserMembership: { role: "manager" },
      isOwner: false,
      isManager: true,
    } as unknown as TEnvironmentAuth;
    vi.mocked(getEnvironmentAuth).mockResolvedValue(managerAuth);

    const props = {
      params: Promise.resolve(mockParams),
    };
    const PageComponent = await Page(props);
    render(PageComponent);

    expect(EmailCustomizationSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        isReadOnly: false, // owner or manager can edit
      }),
      undefined
    );
    expect(DeleteOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeleteDisabled: true, // only owner can delete
        isUserOwner: false,
      }),
      undefined
    );
  });

  test("renders correctly when multi-org is disabled", async () => {
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    const props = {
      params: Promise.resolve(mockParams),
    };
    const PageComponent = await Page(props);
    render(PageComponent);

    expect(screen.queryByText("environments.settings.general.delete_organization")).not.toBeInTheDocument();
    expect(DeleteOrganization).not.toHaveBeenCalled();
    // isDeleteDisabled should be true because multiOrg is disabled, even for owner
    expect(EmailCustomizationSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        isReadOnly: false,
      }),
      undefined
    );
  });

  test("renders correctly when user is not owner or manager (e.g., admin)", async () => {
    const adminAuth = {
      ...mockEnvironmentAuth,
      currentUserMembership: { role: "admin" },
      isOwner: false,
      isManager: false,
    } as unknown as TEnvironmentAuth;
    vi.mocked(getEnvironmentAuth).mockResolvedValue(adminAuth);

    const props = {
      params: Promise.resolve(mockParams),
    };
    const PageComponent = await Page(props);
    render(PageComponent);

    expect(EmailCustomizationSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        isReadOnly: true,
      }),
      undefined
    );
    expect(DeleteOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeleteDisabled: true,
        isUserOwner: false,
      }),
      undefined
    );
  });

  test("renders if session user id empty, user is null", async () => {
    const noUserSessionAuth = {
      ...mockEnvironmentAuth,
      session: { ...mockEnvironmentAuth.session, user: { ...mockEnvironmentAuth.session.user, id: "" } },
    };
    vi.mocked(getEnvironmentAuth).mockResolvedValue(noUserSessionAuth);
    vi.mocked(getUser).mockResolvedValue(null);

    const props = {
      params: Promise.resolve(mockParams),
    };

    const PageComponent = await Page(props);
    render(PageComponent);
    expect(screen.getByText("environments.settings.general.organization_settings")).toBeInTheDocument();
    expect(EmailCustomizationSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        user: null,
      }),
      undefined
    );
  });

  test("handles getEnvironmentAuth error", async () => {
    vi.mocked(getEnvironmentAuth).mockRejectedValue(new Error("Authentication error"));

    const props = {
      params: Promise.resolve({ environmentId: "env-123" }),
    };

    await expect(Page(props)).rejects.toThrow("Authentication error");
  });
});
