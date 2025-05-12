import { TProjectTeam } from "@/modules/ee/teams/project-teams/types/team";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AccessTable } from "./access-table";

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe("AccessTable", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders no teams found row when teams is empty", () => {
    render(<AccessTable teams={[]} />);
    expect(screen.getByText("environments.project.teams.no_teams_found")).toBeInTheDocument();
  });

  test("renders team rows with correct data and permission mapping", () => {
    const teams: TProjectTeam[] = [
      { id: "1", name: "Team A", memberCount: 1, permission: "readWrite" },
      { id: "2", name: "Team B", memberCount: 2, permission: "read" },
    ];
    render(<AccessTable teams={teams} />);
    expect(screen.getByText("Team A")).toBeInTheDocument();
    expect(screen.getByText("Team B")).toBeInTheDocument();
    expect(screen.getByText("1 common.member")).toBeInTheDocument();
    expect(screen.getByText("2 common.members")).toBeInTheDocument();
    expect(screen.getByText(TeamPermissionMapping["readWrite"])).toBeInTheDocument();
    expect(screen.getByText(TeamPermissionMapping["read"])).toBeInTheDocument();
  });

  test("renders table headers with tolgee keys", () => {
    render(<AccessTable teams={[]} />);
    expect(screen.getByText("environments.project.teams.team_name")).toBeInTheDocument();
    expect(screen.getByText("common.size")).toBeInTheDocument();
    expect(screen.getByText("environments.project.teams.permission")).toBeInTheDocument();
  });
});
