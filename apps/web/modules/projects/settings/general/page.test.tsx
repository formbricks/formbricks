import { getProjects } from "@/lib/project/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { GeneralSettingsPage } from "./page";

vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: (props: any) => <div data-testid="project-config-navigation" {...props} />,
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="page-content-wrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }: any) => (
    <div data-testid="page-header">
      <div>{pageTitle}</div>
      {children}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/settings-id", () => ({
  SettingsId: ({ title, id }: any) => (
    <div data-testid="settings-id">
      <p>{title}</p>:<p>{id}</p>
    </div>
  ),
}));
vi.mock("./components/edit-project-name-form", () => ({
  EditProjectNameForm: (props: any) => <div data-testid="edit-project-name-form">{props.project.id}</div>,
}));
vi.mock("./components/edit-waiting-time-form", () => ({
  EditWaitingTimeForm: (props: any) => <div data-testid="edit-waiting-time-form">{props.project.id}</div>,
}));
vi.mock("./components/delete-project", () => ({
  DeleteProject: (props: any) => <div data-testid="delete-project">{props.environmentId}</div>,
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => {
    // Return a mock translator that just returns the key
    return (key: string) => key;
  }),
}));
const mockProject = {
  id: "proj-1",
  name: "Project 1",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org-1",
  environments: [],
} as any;

const mockOrganization: TOrganization = {
  id: "org-1",
  name: "Org 1",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    plan: "free",
    limits: { monthly: { miu: 10, responses: 10 }, projects: 4 },
    period: "monthly",
    periodStart: new Date(),
    stripeCustomerId: null,
  },
  isAIEnabled: false,
};

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));
vi.mock("@/lib/project/service", () => ({
  getProjects: vi.fn(),
}));
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_DEVELOPMENT: false,
}));
vi.mock("@/package.json", () => ({
  default: {
    version: "1.2.3",
  },
}));

describe("GeneralSettingsPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all tolgee strings and main UI elements", async () => {
    const props = { params: { environmentId: "env1" } } as any;

    vi.mocked(getProjects).mockResolvedValue([mockProject]);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      isOwner: true,
      isManager: false,
      project: mockProject,
      organization: mockOrganization,
    } as any);

    const Page = await GeneralSettingsPage(props);
    render(Page);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("project-config-navigation")).toBeInTheDocument();
    expect(screen.getAllByTestId("settings-id").length).toBe(2);
    expect(screen.getByTestId("edit-project-name-form")).toBeInTheDocument();
    expect(screen.getByTestId("edit-waiting-time-form")).toBeInTheDocument();
    expect(screen.getByTestId("delete-project")).toBeInTheDocument();
    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
    expect(screen.getByText("common.project_name")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.general.project_name_settings_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.project.general.recontact_waiting_time")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.general.recontact_waiting_time_settings_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.project.general.delete_project")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.general.delete_project_settings_description")
    ).toBeInTheDocument();
    expect(screen.getByText("common.project_id")).toBeInTheDocument();
    expect(screen.getByText("common.formbricks_version")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
  });
});
