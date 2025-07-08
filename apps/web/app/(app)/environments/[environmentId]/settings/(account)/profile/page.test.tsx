import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getIsMultiOrgEnabled, getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import Page from "./page";

// Mock services and utils
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: 1,
  PASSWORD_RESET_DISABLED: 1,
  EMAIL_VERIFICATION_DISABLED: true,
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
  getIsTwoFactorAuthEnabled: vi.fn(),
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

const t = (key: any) => key;
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => t,
}));

// Mock child components
vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar",
  () => ({
    AccountSettingsNavbar: ({ environmentId, activeId }) => (
      <div data-testid="account-settings-navbar">
        AccountSettingsNavbar: {environmentId} {activeId}
      </div>
    ),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(account)/profile/components/AccountSecurity",
  () => ({
    AccountSecurity: ({ user }) => <div data-testid="account-security">AccountSecurity: {user.id}</div>,
  })
);
vi.mock("./components/DeleteAccount", () => ({
  DeleteAccount: ({ user }) => <div data-testid="delete-account">DeleteAccount: {user.id}</div>,
}));
vi.mock("./components/EditProfileAvatarForm", () => ({
  EditProfileAvatarForm: ({ _, environmentId }) => (
    <div data-testid="edit-profile-avatar-form">EditProfileAvatarForm: {environmentId}</div>
  ),
}));
vi.mock("./components/EditProfileDetailsForm", () => ({
  EditProfileDetailsForm: ({ user }) => (
    <div data-testid="edit-profile-details-form">EditProfileDetailsForm: {user.id}</div>
  ),
}));
vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: ({ title }) => <div data-testid="upgrade-prompt">{title}</div>,
}));

const mockUser = {
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  imageUrl: "http://example.com/avatar.png",
  twoFactorEnabled: false,
  identityProvider: "email",
  notificationSettings: { alert: {}, weeklySummary: {}, unsubscribedOrganizationIds: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
  role: "project_manager",
  objective: "other",
} as unknown as TUser;

const mockSession: Session = {
  user: mockUser,
  expires: "never",
};

const mockOrganizations: TOrganization[] = [];

const params = { environmentId: "env-123" };

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue(mockOrganizations);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: mockSession,
    } as unknown as TEnvironmentAuth);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getIsTwoFactorAuthEnabled).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("renders profile page with all sections for email user with 2FA license", async () => {
    render(await Page({ params: Promise.resolve(params) }));

    await waitFor(() => {
      expect(screen.getByText("common.account_settings")).toBeInTheDocument();
      expect(screen.getByTestId("account-settings-navbar")).toHaveTextContent(
        "AccountSettingsNavbar: env-123 profile"
      );
      expect(screen.getByTestId("edit-profile-details-form")).toBeInTheDocument();
      expect(screen.getByTestId("edit-profile-avatar-form")).toBeInTheDocument();
      expect(screen.getByTestId("account-security")).toBeInTheDocument(); // Shown because 2FA license is enabled
      expect(screen.queryByTestId("upgrade-prompt")).not.toBeInTheDocument();
      expect(screen.getByTestId("delete-account")).toBeInTheDocument();
      // Use a regex to match the text content, allowing for variable whitespace
      expect(screen.getByText(new RegExp(`common\\.profile\\s*:\\s*${mockUser.id}`))).toBeInTheDocument(); // SettingsId
    });
  });

  test("renders UpgradePrompt when 2FA license is disabled and user 2FA is off", async () => {
    vi.mocked(getIsTwoFactorAuthEnabled).mockResolvedValue(false); // License disabled
    const userWith2FAOff = { ...mockUser, twoFactorEnabled: false };
    vi.mocked(getUser).mockResolvedValue(userWith2FAOff);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: { ...mockSession, user: userWith2FAOff },
    } as unknown as TEnvironmentAuth);

    render(await Page({ params: Promise.resolve(params) }));

    await waitFor(() => {
      expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
      expect(screen.getByTestId("upgrade-prompt")).toHaveTextContent(
        "environments.settings.profile.unlock_two_factor_authentication"
      );
      expect(screen.queryByTestId("account-security")).not.toBeInTheDocument();
    });
  });

  test("renders AccountSecurity when 2FA license is disabled but user 2FA is on", async () => {
    vi.mocked(getIsTwoFactorAuthEnabled).mockResolvedValue(false); // License disabled
    const userWith2FAOn = { ...mockUser, twoFactorEnabled: true };
    vi.mocked(getUser).mockResolvedValue(userWith2FAOn);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: { ...mockSession, user: userWith2FAOn },
    } as unknown as TEnvironmentAuth);

    render(await Page({ params: Promise.resolve(params) }));

    await waitFor(() => {
      expect(screen.getByTestId("account-security")).toBeInTheDocument();
      expect(screen.queryByTestId("upgrade-prompt")).not.toBeInTheDocument();
    });
  });

  test("does not render security card if identityProvider is not email", async () => {
    const nonEmailUser = { ...mockUser, identityProvider: "google" as "email" | "github" | "google" }; // type assertion
    vi.mocked(getUser).mockResolvedValue(nonEmailUser);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: { ...mockSession, user: nonEmailUser },
    } as unknown as TEnvironmentAuth);

    render(await Page({ params: Promise.resolve(params) }));

    await waitFor(() => {
      expect(screen.queryByTestId("account-security")).not.toBeInTheDocument();
      expect(screen.queryByTestId("upgrade-prompt")).not.toBeInTheDocument();
      expect(screen.queryByText("common.security")).not.toBeInTheDocument();
    });
  });

  test("throws error if user is not found", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    // Need to catch the promise rejection for async component errors
    try {
      // We don't await the render directly, but the component execution
      await Page({ params: Promise.resolve(params) });
    } catch (e) {
      expect(e.message).toBe("common.user_not_found");
    }
  });
});
