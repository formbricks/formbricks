import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getTranslate } from "@/tolgee/server";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getTeamsByProjectId } from "./lib/team";
import { ProjectTeams } from "./page";

vi.mock("@/modules/ee/teams/project-teams/components/access-view", () => ({
  AccessView: (props: any) => <div data-testid="AccessView">{JSON.stringify(props)}</div>,
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));
vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: (props: any) => (
    <div data-testid="ProjectConfigNavigation">{JSON.stringify(props)}</div>
  ),
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="PageContentWrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }: any) => (
    <div data-testid="PageHeader">
      <span>{pageTitle}</span>
      {children}
    </div>
  ),
}));
vi.mock("./lib/team", () => ({
  getTeamsByProjectId: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

describe("ProjectTeams", () => {
  const params = Promise.resolve({ environmentId: "env-1" });

  beforeEach(() => {
    vi.mocked(getTeamsByProjectId).mockResolvedValue([
      { id: "team-1", name: "Team 1", memberCount: 2, permission: "readWrite" },
      { id: "team-2", name: "Team 2", memberCount: 1, permission: "read" },
    ]);
    vi.mocked(getTranslate).mockResolvedValue((key) => key);

    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      project: { id: "project-1" },
      isOwner: true,
      isManager: false,
    } as any);
  });
  afterEach(() => {
    cleanup();
  });

  test("renders all main components and passes correct props", async () => {
    const ui = await ProjectTeams({ params });
    render(ui);
    expect(screen.getByTestId("PageContentWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("PageHeader")).toBeInTheDocument();
    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
    expect(screen.getByTestId("ProjectConfigNavigation")).toBeInTheDocument();
    expect(screen.getByTestId("AccessView")).toHaveTextContent('"environmentId":"env-1"');
    expect(screen.getByTestId("AccessView")).toHaveTextContent('"isOwnerOrManager":true');
  });

  test("throws error if teams is null", async () => {
    vi.mocked(getTeamsByProjectId).mockResolvedValue(null);
    await expect(ProjectTeams({ params })).rejects.toThrow("common.teams_not_found");
  });
});
