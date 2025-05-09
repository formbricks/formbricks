import { TProjectTeam } from "@/modules/ee/teams/project-teams/types/team";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AccessView } from "./access-view";

vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ title, description, children }: any) => (
    <div data-testid="SettingsCard">
      <div>{title}</div>
      <div>{description}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ee/teams/project-teams/components/manage-team", () => ({
  ManageTeam: ({ environmentId, isOwnerOrManager }: any) => (
    <button data-testid="ManageTeam">
      ManageTeam {environmentId} {isOwnerOrManager ? "owner" : "not-owner"}
    </button>
  ),
}));

vi.mock("@/modules/ee/teams/project-teams/components/access-table", () => ({
  AccessTable: ({ teams }: any) => (
    <div data-testid="AccessTable">
      {teams.length === 0 ? "No teams" : `Teams: ${teams.map((t: any) => t.name).join(",")}`}
    </div>
  ),
}));

describe("AccessView", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    environmentId: "env-1",
    isOwnerOrManager: true,
    teams: [
      { id: "1", name: "Team A", memberCount: 2, permission: "readWrite" } as TProjectTeam,
      { id: "2", name: "Team B", memberCount: 1, permission: "read" } as TProjectTeam,
    ],
  };

  test("renders SettingsCard with tolgee strings and children", () => {
    render(<AccessView {...baseProps} />);
    expect(screen.getByTestId("SettingsCard")).toBeInTheDocument();
    expect(screen.getByText("common.team_access")).toBeInTheDocument();
    expect(screen.getByText("environments.project.teams.team_settings_description")).toBeInTheDocument();
  });

  test("renders ManageTeam with correct props", () => {
    render(<AccessView {...baseProps} />);
    expect(screen.getByTestId("ManageTeam")).toHaveTextContent("ManageTeam env-1 owner");
  });

  test("renders AccessTable with teams", () => {
    render(<AccessView {...baseProps} />);
    expect(screen.getByTestId("AccessTable")).toHaveTextContent("Teams: Team A,Team B");
  });

  test("renders AccessTable with no teams", () => {
    render(<AccessView {...baseProps} teams={[]} />);
    expect(screen.getByTestId("AccessTable")).toHaveTextContent("No teams");
  });

  test("renders ManageTeam as not-owner when isOwnerOrManager is false", () => {
    render(<AccessView {...baseProps} isOwnerOrManager={false} />);
    expect(screen.getByTestId("ManageTeam")).toHaveTextContent("not-owner");
  });
});
