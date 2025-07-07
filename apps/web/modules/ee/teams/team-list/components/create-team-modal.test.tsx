import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createTeamAction } from "@/modules/ee/teams/team-list/actions";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CreateTeamModal } from "./create-team-modal";

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
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock("@/modules/ee/teams/team-list/actions", () => ({
  createTeamAction: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(() => "error-message"),
}));

describe("CreateTeamModal", () => {
  afterEach(() => {
    cleanup();
  });

  const setOpen = vi.fn();

  test("renders dialog, form, and tolgee strings", () => {
    render(<CreateTeamModal open={true} setOpen={setOpen} organizationId="org-1" />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.create_new_team")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.team_name")).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.create")).toBeInTheDocument();
  });

  test("calls setOpen(false) and resets teamName on cancel", async () => {
    render(<CreateTeamModal open={true} setOpen={setOpen} organizationId="org-1" />);
    const input = screen.getByPlaceholderText("environments.settings.teams.enter_team_name");
    await userEvent.type(input, "My Team");
    await userEvent.click(screen.getByText("common.cancel"));
    expect(setOpen).toHaveBeenCalledWith(false);
    expect((input as HTMLInputElement).value).toBe("");
  });

  test("submit button is disabled when input is empty", () => {
    render(<CreateTeamModal open={true} setOpen={setOpen} organizationId="org-1" />);
    expect(screen.getByText("environments.settings.teams.create")).toBeDisabled();
  });

  test("calls createTeamAction, shows success toast, calls onCreate, refreshes and closes dialog on success", async () => {
    vi.mocked(createTeamAction).mockResolvedValue({ data: "team-123" });
    const onCreate = vi.fn();
    render(<CreateTeamModal open={true} setOpen={setOpen} organizationId="org-1" onCreate={onCreate} />);
    const input = screen.getByPlaceholderText("environments.settings.teams.enter_team_name");
    await userEvent.type(input, "My Team");
    await userEvent.click(screen.getByText("environments.settings.teams.create"));
    await waitFor(() => {
      expect(createTeamAction).toHaveBeenCalledWith({ name: "My Team", organizationId: "org-1" });
      expect(toast.success).toHaveBeenCalledWith("environments.settings.teams.team_created_successfully");
      expect(onCreate).toHaveBeenCalledWith("team-123");
      expect(setOpen).toHaveBeenCalledWith(false);
      expect((input as HTMLInputElement).value).toBe("");
    });
  });

  test("shows error toast if createTeamAction fails", async () => {
    vi.mocked(createTeamAction).mockResolvedValue({});
    render(<CreateTeamModal open={true} setOpen={setOpen} organizationId="org-1" />);
    const input = screen.getByPlaceholderText("environments.settings.teams.enter_team_name");
    await userEvent.type(input, "My Team");
    await userEvent.click(screen.getByText("environments.settings.teams.create"));
    await waitFor(() => {
      expect(getFormattedErrorMessage).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("error-message");
    });
  });
});
