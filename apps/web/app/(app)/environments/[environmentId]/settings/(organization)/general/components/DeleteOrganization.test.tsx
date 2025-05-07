import { deleteOrganizationAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization, TOrganizationBilling } from "@formbricks/types/organizations";
import { DeleteOrganization } from "./DeleteOrganization";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions", () => ({
  deleteOrganizationAction: vi.fn(),
}));

const mockT = (key: string, params?: any) => {
  if (params && typeof params === "object") {
    let translation = key;
    for (const p in params) {
      translation = translation.replace(`{{${p}}}`, params[p]);
    }
    return translation;
  }
  return key;
};

const organizationMock = {
  id: "org_123",
  name: "Test Organization",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    stripeCustomerId: null,
    plan: "free",
  } as unknown as TOrganizationBilling,
} as unknown as TOrganization;

const mockRouterPush = vi.fn();

const renderComponent = (props: Partial<Parameters<typeof DeleteOrganization>[0]> = {}) => {
  const defaultProps = {
    organization: organizationMock,
    isDeleteDisabled: false,
    isUserOwner: true,
    ...props,
  };
  return render(<DeleteOrganization {...defaultProps} />);
};

describe("DeleteOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockRouterPush } as any);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders delete button and info text when delete is not disabled", () => {
    renderComponent();
    expect(screen.getByText("environments.settings.general.once_its_gone_its_gone")).toBeInTheDocument();
    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
  });

  test("renders warning and no delete button when delete is disabled and user is owner", () => {
    renderComponent({ isDeleteDisabled: true, isUserOwner: true });
    expect(
      screen.getByText("environments.settings.general.cannot_delete_only_organization")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.delete" })).not.toBeInTheDocument();
  });

  test("renders warning and no delete button when delete is disabled and user is not owner", () => {
    renderComponent({ isDeleteDisabled: true, isUserOwner: false });
    expect(
      screen.getByText("environments.settings.general.only_org_owner_can_perform_action")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.delete" })).not.toBeInTheDocument();
  });

  test("opens delete dialog on button click", async () => {
    renderComponent();
    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await userEvent.click(deleteButton);
    expect(screen.getByText("environments.settings.general.delete_organization_warning")).toBeInTheDocument();
    expect(
      screen.getByText(
        mockT("environments.settings.general.delete_organization_warning_3", {
          organizationName: organizationMock.name,
        })
      )
    ).toBeInTheDocument();
  });

  test("delete button in modal is disabled until correct organization name is typed", async () => {
    renderComponent();
    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await userEvent.click(deleteButton);

    const dialog = screen.getByRole("dialog");
    const modalDeleteButton = within(dialog).getByRole("button", { name: "common.delete" });
    expect(modalDeleteButton).toBeDisabled();

    const inputField = screen.getByPlaceholderText(organizationMock.name);
    await userEvent.type(inputField, organizationMock.name);
    expect(modalDeleteButton).not.toBeDisabled();

    await userEvent.clear(inputField);
    await userEvent.type(inputField, "Wrong Name");
    expect(modalDeleteButton).toBeDisabled();
  });

  test("calls deleteOrganizationAction on confirm, shows success, clears localStorage, and navigates", async () => {
    vi.mocked(deleteOrganizationAction).mockResolvedValue({} as any);
    localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, "some-env-id");
    renderComponent();

    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await userEvent.click(deleteButton);

    const inputField = screen.getByPlaceholderText(organizationMock.name);
    await userEvent.type(inputField, organizationMock.name);

    const dialog = screen.getByRole("dialog");
    const modalDeleteButton = within(dialog).getByRole("button", { name: "common.delete" });
    await userEvent.click(modalDeleteButton);

    await waitFor(() => {
      expect(deleteOrganizationAction).toHaveBeenCalledWith({ organizationId: organizationMock.id });
      expect(toast.success).toHaveBeenCalledWith(
        "environments.settings.general.organization_deleted_successfully"
      );
      expect(localStorage.getItem(FORMBRICKS_ENVIRONMENT_ID_LS)).toBeNull();
      expect(mockRouterPush).toHaveBeenCalledWith("/");
      expect(
        screen.queryByText("environments.settings.general.delete_organization_warning")
      ).not.toBeInTheDocument(); // Modal should close
    });
  });

  test("shows error toast on deleteOrganizationAction failure", async () => {
    vi.mocked(deleteOrganizationAction).mockRejectedValue(new Error("Deletion failed"));
    renderComponent();

    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await userEvent.click(deleteButton);

    const inputField = screen.getByPlaceholderText(organizationMock.name);
    await userEvent.type(inputField, organizationMock.name);

    const dialog = screen.getByRole("dialog");
    const modalDeleteButton = within(dialog).getByRole("button", { name: "common.delete" });
    await userEvent.click(modalDeleteButton);

    await waitFor(() => {
      expect(deleteOrganizationAction).toHaveBeenCalledWith({ organizationId: organizationMock.id });
      expect(toast.error).toHaveBeenCalledWith(
        "environments.settings.general.error_deleting_organization_please_try_again"
      );
      expect(
        screen.queryByText("environments.settings.general.delete_organization_warning")
      ).not.toBeInTheDocument(); // Modal should close
    });
  });

  test("closes modal on cancel click", async () => {
    renderComponent();
    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await userEvent.click(deleteButton);

    expect(screen.getByText("environments.settings.general.delete_organization_warning")).toBeInTheDocument();
    const cancelButton = screen.getByRole("button", { name: "common.cancel" });
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.queryByText("environments.settings.general.delete_organization_warning")
      ).not.toBeInTheDocument();
    });
  });
});
