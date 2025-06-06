import { createOrganizationAction } from "@/modules/organization/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CreateOrganizationModal } from "./index";

vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  PlusCircleIcon: () => <svg data-testid="plus-icon" />,
}));
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
}));
vi.mock("@/modules/organization/actions", () => ({
  createOrganizationAction: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(() => "Formatted error"),
}));
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (k) => k }),
}));

describe("CreateOrganizationModal", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders dialog and form fields", () => {
    render(<CreateOrganizationModal open={true} setOpen={vi.fn()} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("environments.settings.general.organization_name_placeholder")
    ).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
  });

  test("disables submit button if organization name is empty", () => {
    render(<CreateOrganizationModal open={true} setOpen={vi.fn()} />);
    const submitBtn = screen.getByText("environments.settings.general.create_new_organization", {
      selector: "button[type='submit']",
    });
    expect(submitBtn).toBeDisabled();
  });

  test("enables submit button when organization name is entered", async () => {
    render(<CreateOrganizationModal open={true} setOpen={vi.fn()} />);
    const input = screen.getByPlaceholderText("environments.settings.general.organization_name_placeholder");
    const submitBtn = screen.getByText("environments.settings.general.create_new_organization", {
      selector: "button[type='submit']",
    });
    await userEvent.type(input, "Formbricks Org");
    expect(submitBtn).not.toBeDisabled();
  });

  test("calls createOrganizationAction and closes dialog on success", async () => {
    const setOpen = vi.fn();
    vi.mocked(createOrganizationAction).mockResolvedValue({ data: { id: "org-1" } } as any);
    render(<CreateOrganizationModal open={true} setOpen={setOpen} />);
    const input = screen.getByPlaceholderText("environments.settings.general.organization_name_placeholder");
    await userEvent.type(input, "Formbricks Org");
    const submitBtn = screen.getByText("environments.settings.general.create_new_organization", {
      selector: "button[type='submit']",
    });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(createOrganizationAction).toHaveBeenCalledWith({ organizationName: "Formbricks Org" });
      expect(setOpen).toHaveBeenCalledWith(false);
      expect(mockPush).toHaveBeenCalledWith("/organizations/org-1");
    });
  });

  test("shows error toast on failure", async () => {
    const setOpen = vi.fn();
    vi.mocked(createOrganizationAction).mockResolvedValue({});
    render(<CreateOrganizationModal open={true} setOpen={setOpen} />);
    const input = screen.getByPlaceholderText("environments.settings.general.organization_name_placeholder");
    await userEvent.type(input, "Fail Org");
    const submitBtn = screen.getByText("environments.settings.general.create_new_organization", {
      selector: "button[type='submit']",
    });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Formatted error");
    });
  });

  test("does not submit if name is only whitespace", async () => {
    const setOpen = vi.fn();
    render(<CreateOrganizationModal open={true} setOpen={setOpen} />);
    const input = screen.getByPlaceholderText("environments.settings.general.organization_name_placeholder");
    await userEvent.type(input, "   ");
    const submitBtn = screen.getByText("environments.settings.general.create_new_organization", {
      selector: "button[type='submit']",
    });
    await userEvent.click(submitBtn);
    expect(createOrganizationAction).not.toHaveBeenCalled();
  });

  test("calls setOpen(false) when cancel is clicked", async () => {
    const setOpen = vi.fn();
    render(<CreateOrganizationModal open={true} setOpen={setOpen} />);
    const cancelBtn = screen.getByText("common.cancel");
    await userEvent.click(cancelBtn);
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
