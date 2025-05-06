import { updateOrganizationNameAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { EditOrganizationNameForm } from "./EditOrganizationNameForm";

vi.mock("@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions", () => ({
  updateOrganizationNameAction: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

const organizationMock = {
  id: "org_123",
  name: "Old Organization Name",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    stripeCustomerId: null,
    plan: "free",
  } as unknown as TOrganization["billing"],
} as unknown as TOrganization;

const renderForm = (membershipRole: "owner" | "member") => {
  return render(
    <EditOrganizationNameForm
      environmentId="env_123"
      organization={organizationMock}
      membershipRole={membershipRole}
    />
  );
};

describe("EditOrganizationNameForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(updateOrganizationNameAction).mockReset();
  });

  test("renders with initial organization name and allows owner to update", async () => {
    renderForm("owner");

    const nameInput = screen.getByPlaceholderText(
      "environments.settings.general.organization_name_placeholder"
    );
    expect(nameInput).toHaveValue(organizationMock.name);
    expect(nameInput).not.toBeDisabled();

    const updateButton = screen.getByText("common.update");
    expect(updateButton).toBeDisabled(); // Initially disabled as form is not dirty

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "New Organization Name");
    expect(updateButton).not.toBeDisabled(); // Enabled after change

    vi.mocked(updateOrganizationNameAction).mockResolvedValueOnce({
      data: { ...organizationMock, name: "New Organization Name" },
    });

    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(updateOrganizationNameAction).toHaveBeenCalledWith({
        organizationId: organizationMock.id,
        data: { name: "New Organization Name" },
      });
      expect(
        screen.getByPlaceholderText("environments.settings.general.organization_name_placeholder")
      ).toHaveValue("New Organization Name");
      expect(toast.success).toHaveBeenCalledWith(
        "environments.settings.general.organization_name_updated_successfully"
      );
    });
    expect(updateButton).toBeDisabled(); // Disabled after successful submit and reset
  });

  test("shows error toast on update failure", async () => {
    renderForm("owner");

    const nameInput = screen.getByPlaceholderText(
      "environments.settings.general.organization_name_placeholder"
    );
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Another Name");

    const updateButton = screen.getByText("common.update");

    vi.mocked(updateOrganizationNameAction).mockResolvedValueOnce({
      data: null as any,
    });

    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(updateOrganizationNameAction).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("");
    });
    expect(nameInput).toHaveValue("Another Name"); // Name should not reset on error
  });

  test("shows generic error toast on exception during update", async () => {
    renderForm("owner");

    const nameInput = screen.getByPlaceholderText(
      "environments.settings.general.organization_name_placeholder"
    );
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Exception Name");

    const updateButton = screen.getByText("common.update");

    vi.mocked(updateOrganizationNameAction).mockRejectedValueOnce(new Error("Network error"));

    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(updateOrganizationNameAction).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Error: Network error");
    });
  });

  test("disables input and button for non-owner roles and shows warning", async () => {
    const roles: "member"[] = ["member"];
    for (const role of roles) {
      renderForm(role);

      const nameInput = screen.getByPlaceholderText(
        "environments.settings.general.organization_name_placeholder"
      );
      expect(nameInput).toBeDisabled();

      const updateButton = screen.getByText("common.update");
      expect(updateButton).toBeDisabled();

      expect(
        screen.getByText("environments.settings.general.only_org_owner_can_perform_action")
      ).toBeInTheDocument();
      cleanup();
    }
  });
});
