import { getTeamDetailsAction, getTeamRoleAction } from "@/modules/ee/teams/team-list/actions";
import { TOrganizationMember, TOtherTeam, TUserTeam } from "@/modules/ee/teams/team-list/types/team";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TeamsTable } from "./teams-table";

vi.mock("@/modules/ee/teams/team-list/components/create-team-button", () => ({
  CreateTeamButton: ({ organizationId }: any) => (
    <button data-testid="CreateTeamButton">{organizationId}</button>
  ),
}));

vi.mock("@/modules/ee/teams/team-list/components/manage-team-button", () => ({
  ManageTeamButton: ({ disabled, onClick }: any) => (
    <button data-testid="ManageTeamButton" disabled={disabled} onClick={onClick}>
      environments.settings.teams.manage_team
    </button>
  ),
}));
vi.mock("@/modules/ee/teams/team-list/components/team-settings/team-settings-modal", () => ({
  TeamSettingsModal: (props: any) => <div data-testid="TeamSettingsModal">{props.team?.name}</div>,
}));

vi.mock("@/modules/ee/teams/team-list/action", () => ({
  getTeamDetailsAction: vi.fn(),
  getTeamRoleAction: vi.fn(),
}));

vi.mock("@/modules/ui/components/badge", () => ({
  Badge: ({ text }: any) => <span data-testid="Badge">{text}</span>,
}));

const userTeams: TUserTeam[] = [
  { id: "1", name: "Alpha", memberCount: 2, userRole: "admin" },
  { id: "2", name: "Beta", memberCount: 1, userRole: "contributor" },
];
const otherTeams: TOtherTeam[] = [
  { id: "3", name: "Gamma", memberCount: 3 },
  { id: "4", name: "Delta", memberCount: 1 },
];
const orgMembers: TOrganizationMember[] = [{ id: "u1", name: "User 1", role: "manager" }];
const orgProjects = [{ id: "p1", name: "Project 1" }];

describe("TeamsTable", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders CreateTeamButton for owner/manager", () => {
    render(
      <TeamsTable
        teams={{ userTeams: [], otherTeams: [] }}
        organizationId="org-1"
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        membershipRole="owner"
        currentUserId="u1"
      />
    );
    expect(screen.getByTestId("CreateTeamButton")).toHaveTextContent("org-1");
  });

  test("does not render CreateTeamButton for non-owner/manager", () => {
    render(
      <TeamsTable
        teams={{ userTeams: [], otherTeams: [] }}
        organizationId="org-1"
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        membershipRole={undefined}
        currentUserId="u1"
      />
    );
    expect(screen.queryByTestId("CreateTeamButton")).toBeNull();
  });

  test("renders empty state row if no teams", () => {
    render(
      <TeamsTable
        teams={{ userTeams: [], otherTeams: [] }}
        organizationId="org-1"
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        membershipRole="owner"
        currentUserId="u1"
      />
    );
    expect(screen.getByText("environments.settings.teams.empty_teams_state")).toBeInTheDocument();
  });

  test("renders userTeams and otherTeams rows", () => {
    render(
      <TeamsTable
        teams={{ userTeams, otherTeams }}
        organizationId="org-1"
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        membershipRole="owner"
        currentUserId="u1"
      />
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.getByText("Delta")).toBeInTheDocument();
    expect(screen.getAllByTestId("ManageTeamButton").length).toBe(4);
    expect(screen.getAllByTestId("Badge")[0]).toHaveTextContent(
      "environments.settings.teams.you_are_a_member"
    );
    expect(screen.getByText("2 common.members")).toBeInTheDocument();
  });

  test("opens TeamSettingsModal when ManageTeamButton is clicked and team details are returned", async () => {
    vi.mocked(getTeamDetailsAction).mockResolvedValue({
      data: { id: "1", name: "Alpha", organizationId: "org-1", members: [], projects: [] },
    });
    vi.mocked(getTeamRoleAction).mockResolvedValue({ data: "admin" });
    render(
      <TeamsTable
        teams={{ userTeams, otherTeams }}
        organizationId="org-1"
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        membershipRole="owner"
        currentUserId="u1"
      />
    );
    await userEvent.click(screen.getAllByTestId("ManageTeamButton")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("TeamSettingsModal")).toHaveTextContent("Alpha");
    });
  });

  test("shows error toast if getTeamDetailsAction fails", async () => {
    vi.mocked(getTeamDetailsAction).mockResolvedValue({ data: undefined });
    vi.mocked(getTeamRoleAction).mockResolvedValue({ data: undefined });
    render(
      <TeamsTable
        teams={{ userTeams, otherTeams }}
        organizationId="org-1"
        orgMembers={orgMembers}
        orgProjects={orgProjects}
        membershipRole="owner"
        currentUserId="u1"
      />
    );
    await userEvent.click(screen.getAllByTestId("ManageTeamButton")[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
