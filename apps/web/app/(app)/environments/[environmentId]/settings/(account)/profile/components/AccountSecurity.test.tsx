import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { AccountSecurity } from "./AccountSecurity";

vi.mock("@/modules/ee/two-factor-auth/components/enable-two-factor-modal", () => ({
  EnableTwoFactorModal: ({ open }) =>
    open ? <div data-testid="enable-2fa-modal">EnableTwoFactorModal</div> : null,
}));

vi.mock("@/modules/ee/two-factor-auth/components/disable-two-factor-modal", () => ({
  DisableTwoFactorModal: ({ open }) =>
    open ? <div data-testid="disable-2fa-modal">DisableTwoFactorModal</div> : null,
}));

const mockUser = {
  id: "test-user-id",
  name: "Test User",
  email: "test@example.com",
  notificationSettings: {
    alert: {},
    weeklySummary: {},
    unsubscribedOrganizationIds: [],
  },
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: "project_manager",
  objective: "other",
} as unknown as TUser;

describe("AccountSecurity", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("renders correctly with 2FA disabled", () => {
    render(<AccountSecurity user={{ ...mockUser, twoFactorEnabled: false }} />);
    expect(screen.getByText("environments.settings.profile.two_factor_authentication")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.profile.two_factor_authentication_description")
    ).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  test("renders correctly with 2FA enabled", () => {
    render(<AccountSecurity user={{ ...mockUser, twoFactorEnabled: true }} />);
    expect(screen.getByRole("switch")).toBeChecked();
  });

  test("opens EnableTwoFactorModal when switch is turned on", async () => {
    render(<AccountSecurity user={{ ...mockUser, twoFactorEnabled: false }} />);
    const switchControl = screen.getByRole("switch");
    await userEvent.click(switchControl);
    expect(screen.getByTestId("enable-2fa-modal")).toBeInTheDocument();
  });

  test("opens DisableTwoFactorModal when switch is turned off", async () => {
    render(<AccountSecurity user={{ ...mockUser, twoFactorEnabled: true }} />);
    const switchControl = screen.getByRole("switch");
    await userEvent.click(switchControl);
    expect(screen.getByTestId("disable-2fa-modal")).toBeInTheDocument();
  });
});
