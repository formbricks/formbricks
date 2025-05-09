import { deleteTeamAction } from "@/modules/ee/teams/team-list/actions";
import { TTeam } from "@/modules/ee/teams/team-list/types/team";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DeleteTeam } from "./delete-team";

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ shouldRender, tooltipContent, children }: any) =>
    shouldRender ? (
      <div data-testid="TooltipRenderer">
        {tooltipContent}
        {children}
      </div>
    ) : (
      <>{children}</>
    ),
}));
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, setOpen, deleteWhat, text, onDelete, isDeleting }: any) =>
    open ? (
      <div data-testid="DeleteDialog">
        <span>{deleteWhat}</span>
        <span>{text}</span>
        <button onClick={onDelete} disabled={isDeleting}>
          Confirm
        </button>
      </div>
    ) : null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/modules/ee/teams/team-list/actions", () => ({
  deleteTeamAction: vi.fn(),
}));

describe("DeleteTeam", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    teamId: "team-1" as TTeam["id"],
    onDelete: vi.fn(),
    isOwnerOrManager: true,
  };

  test("renders danger zone label and delete button enabled for owner/manager", () => {
    render(<DeleteTeam {...baseProps} />);
    expect(screen.getByText("common.danger_zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "environments.settings.teams.delete_team" })).toBeEnabled();
  });

  test("renders tooltip and disables button if not owner/manager", () => {
    render(<DeleteTeam {...baseProps} isOwnerOrManager={false} />);
    expect(screen.getByTestId("TooltipRenderer")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.team_deletion_not_allowed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "environments.settings.teams.delete_team" })).toBeDisabled();
  });

  test("opens dialog on delete button click", async () => {
    render(<DeleteTeam {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "environments.settings.teams.delete_team" }));
    expect(screen.getByTestId("DeleteDialog")).toBeInTheDocument();
    expect(screen.getByText("common.team")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.teams.are_you_sure_you_want_to_delete_this_team")
    ).toBeInTheDocument();
  });

  test("calls deleteTeamAction, shows success toast, calls onDelete, and refreshes on confirm", async () => {
    vi.mocked(deleteTeamAction).mockResolvedValue({ data: true });
    const onDelete = vi.fn();
    render(<DeleteTeam {...baseProps} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: "environments.settings.teams.delete_team" }));
    await userEvent.click(screen.getByText("Confirm"));
    expect(deleteTeamAction).toHaveBeenCalledWith({ teamId: baseProps.teamId });
    expect(toast.success).toHaveBeenCalledWith("environments.settings.teams.team_deleted_successfully");
    expect(onDelete).toHaveBeenCalled();
  });

  test("shows error toast if deleteTeamAction fails", async () => {
    vi.mocked(deleteTeamAction).mockResolvedValue({ data: false });
    render(<DeleteTeam {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "environments.settings.teams.delete_team" }));
    await userEvent.click(screen.getByText("Confirm"));
    expect(toast.error).toHaveBeenCalledWith("common.something_went_wrong_please_try_again");
  });
});
