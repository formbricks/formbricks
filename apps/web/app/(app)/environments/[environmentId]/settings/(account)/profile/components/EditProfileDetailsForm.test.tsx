import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { updateUserAction } from "../actions";
import { EditProfileDetailsForm } from "./EditProfileDetailsForm";

const mockUser = {
  id: "test-user-id",
  name: "Old Name",
  email: "test@example.com",
  locale: "en-US",
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

// Mock window.location.reload
const originalLocation = window.location;
beforeEach(() => {
  vi.stubGlobal("location", {
    ...originalLocation,
    reload: vi.fn(),
  });
});

vi.mock("@/app/(app)/environments/[environmentId]/settings/(account)/profile/actions", () => ({
  updateUserAction: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EditProfileDetailsForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders with initial user data and updates successfully", async () => {
    vi.mocked(updateUserAction).mockResolvedValue({ ...mockUser, name: "New Name" } as any);

    render(<EditProfileDetailsForm user={mockUser} />);

    const nameInput = screen.getByPlaceholderText("common.full_name");
    expect(nameInput).toHaveValue(mockUser.name);
    expect(screen.getByDisplayValue(mockUser.email)).toBeDisabled();
    // Check initial language (English)
    expect(screen.getByText("English (US)")).toBeInTheDocument();

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "New Name");

    // Change language
    const languageDropdownTrigger = screen.getByRole("button", { name: /English/ });
    await userEvent.click(languageDropdownTrigger);
    const germanOption = await screen.findByText("German"); // Assuming 'German' is an option
    await userEvent.click(germanOption);

    const updateButton = screen.getByText("common.update");
    expect(updateButton).toBeEnabled();
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(updateUserAction).toHaveBeenCalledWith({ name: "New Name", locale: "de-DE" });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "environments.settings.profile.profile_updated_successfully"
      );
    });
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  test("shows error toast if update fails", async () => {
    const errorMessage = "Update failed";
    vi.mocked(updateUserAction).mockRejectedValue(new Error(errorMessage));

    render(<EditProfileDetailsForm user={mockUser} />);

    const nameInput = screen.getByPlaceholderText("common.full_name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Another Name");

    const updateButton = screen.getByText("common.update");
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(updateUserAction).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(`common.error: ${errorMessage}`);
    });
  });

  test("update button is disabled initially and enables on change", async () => {
    render(<EditProfileDetailsForm user={mockUser} />);
    const updateButton = screen.getByText("common.update");
    expect(updateButton).toBeDisabled();

    const nameInput = screen.getByPlaceholderText("common.full_name");
    await userEvent.type(nameInput, " updated");
    expect(updateButton).toBeEnabled();
  });
});
