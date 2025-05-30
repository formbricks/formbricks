import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { updateTeamDetailsAction } from "@/modules/ee/teams/team-list/actions";
import { TOrganizationMember, TTeamDetails, ZTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TeamSettingsModal } from "./team-settings-modal";

// Mock the Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-header" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogBody: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-body" className={className}>
      {children}
    </div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock("@/modules/ee/teams/team-list/components/team-settings/delete-team", () => ({
  DeleteTeam: () => <div data-testid="DeleteTeam" />,
}));
vi.mock("@/modules/ee/teams/team-list/actions", () => ({
  updateTeamDetailsAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("TeamSettingsModal", () => {
  afterEach(() => {
    cleanup();
  });

  const orgMembers: TOrganizationMember[] = [
    { id: "1", name: "Alice", role: "member" },
    { id: "2", name: "Bob", role: "manager" },
  ];
  const orgProjects = [
    { id: "p1", name: "Project 1" },
    { id: "p2", name: "Project 2" },
  ];
  const team: TTeamDetails = {
    id: "t1",
    name: "Team 1",
    members: [{ name: "Alice", userId: "1", role: ZTeamRole.enum.contributor }],
    projects: [
      { projectName: "pro1", projectId: "p1", permission: ZTeamPermission.enum.read },
      { projectName: "pro2", projectId: "p2", permission: ZTeamPermission.enum.readWrite },
    ],
    organizationId: "org1",
  };
  const setOpen = vi.fn();

  test("renders modal, form, and tolgee strings", () => {
    render(
      <TeamSettingsModal
        open={true}
        setOpen={setOpen}
        team={team}
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        userTeamRole={ZTeamRole.enum.admin}
        membershipRole={"owner"}
        currentUserId="1"
      />
    );
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.team_name_settings_title")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.team_settings_description")).toBeInTheDocument();
    expect(screen.getByText("common.team_name")).toBeInTheDocument();
    expect(screen.getByText("common.members")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.add_members_description")).toBeInTheDocument();
    expect(screen.getByText("Add member")).toBeInTheDocument();
    expect(screen.getByText("common.projects")).toBeInTheDocument();
    expect(screen.getByText("Add project")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.add_projects_description")).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
    expect(screen.getByTestId("DeleteTeam")).toBeInTheDocument();
  });

  test("calls setOpen(false) when cancel button is clicked", async () => {
    render(
      <TeamSettingsModal
        open={true}
        setOpen={setOpen}
        team={team}
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        userTeamRole={ZTeamRole.enum.admin}
        membershipRole={"owner"}
        currentUserId="1"
      />
    );
    await userEvent.click(screen.getByText("common.cancel"));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("calls updateTeamDetailsAction and shows success toast on submit", async () => {
    vi.mocked(updateTeamDetailsAction).mockResolvedValue({ data: true });
    render(
      <TeamSettingsModal
        open={true}
        setOpen={setOpen}
        team={team}
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        userTeamRole={ZTeamRole.enum.admin}
        membershipRole={"owner"}
        currentUserId="1"
      />
    );
    await userEvent.click(screen.getByText("common.save"));
    await waitFor(() => {
      expect(updateTeamDetailsAction).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("environments.settings.teams.team_updated_successfully");
      expect(setOpen).toHaveBeenCalledWith(false);
    });
  });

  test("shows error toast if updateTeamDetailsAction fails", async () => {
    vi.mocked(updateTeamDetailsAction).mockResolvedValue({ data: false });
    render(
      <TeamSettingsModal
        open={true}
        setOpen={setOpen}
        team={team}
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        userTeamRole={ZTeamRole.enum.admin}
        membershipRole={"owner"}
        currentUserId="1"
      />
    );
    await userEvent.click(screen.getByText("common.save"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
