import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TOrganization } from "@formbricks/types/organizations";
import { HideUnavailableFeaturesToggle } from "./HideUnavailableFeaturesToggle";

const mocks = vi.hoisted(() => ({
  updateOrganizationSettings: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("react-hot-toast", () => ({
  default: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/settings/organization/general/lib/api-client", () => ({
  updateOrganizationSettings: mocks.updateOrganizationSettings,
}));

const ORG_ID = "clorg11111111111111111111";

const organization = (hideUnavailableFeatures: boolean) =>
  ({ id: ORG_ID, name: "Acme", hideUnavailableFeatures }) as TOrganization;

const toggle = () => screen.getByRole("switch");

describe("HideUnavailableFeaturesToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateOrganizationSettings.mockResolvedValue({});
  });
  afterEach(cleanup);

  test("shows the organization's current setting", () => {
    render(<HideUnavailableFeaturesToggle organization={organization(true)} membershipRole="owner" />);

    expect(toggle()).toBeChecked();
  });

  test("lets a manager turn it on, saves it and refreshes the page", async () => {
    render(<HideUnavailableFeaturesToggle organization={organization(false)} membershipRole="manager" />);

    fireEvent.click(toggle());

    await waitFor(() =>
      expect(mocks.updateOrganizationSettings).toHaveBeenCalledWith(ORG_ID, {
        hideUnavailableFeatures: true,
      })
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "workspace.settings.general.navigation_settings_updated_successfully"
    );
  });

  test("lets an owner turn it off", async () => {
    render(<HideUnavailableFeaturesToggle organization={organization(true)} membershipRole="owner" />);

    fireEvent.click(toggle());

    await waitFor(() =>
      expect(mocks.updateOrganizationSettings).toHaveBeenCalledWith(ORG_ID, {
        hideUnavailableFeatures: false,
      })
    );
  });

  test("says what went wrong and keeps the page when saving fails", async () => {
    mocks.updateOrganizationSettings.mockRejectedValue(new Error("network down"));
    render(<HideUnavailableFeaturesToggle organization={organization(false)} membershipRole="owner" />);

    fireEvent.click(toggle());

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(toggle()).toBeEnabled());
  });

  test("is read-only for a member, and says who can change it", () => {
    render(<HideUnavailableFeaturesToggle organization={organization(false)} membershipRole="member" />);

    expect(toggle()).toBeDisabled();
    expect(
      screen.getByText("common.only_owners_managers_and_manage_access_members_can_perform_this_action")
    ).toBeInTheDocument();
    fireEvent.click(toggle());
    expect(mocks.updateOrganizationSettings).not.toHaveBeenCalled();
  });
});
