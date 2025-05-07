import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { ProjectSwitcher } from "./index";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
}));

vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuRadioGroup: ({ children, ...props }: any) => (
    <div data-testid="dropdown-radio-group" {...props}>
      {children}
    </div>
  ),
  DropdownMenuRadioItem: ({ children, ...props }: any) => (
    <div data-testid="dropdown-radio-item" {...props}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
  DropdownMenuItem: ({ children, ...props }: any) => (
    <div data-testid="dropdown-item" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/projects/components/project-limit-modal", () => ({
  ProjectLimitModal: ({ open, setOpen, buttons, projectLimit }: any) =>
    open ? (
      <div data-testid="project-limit-modal">
        <button onClick={() => setOpen(false)} data-testid="close-modal">
          Close
        </button>
        <div data-testid="modal-buttons">
          {buttons[0].text} {buttons[1].text}
        </div>
        <div data-testid="modal-project-limit">{projectLimit}</div>
      </div>
    ) : null,
}));

describe("ProjectSwitcher", () => {
  afterEach(() => {
    cleanup();
  });

  const organization: TOrganization = {
    id: "org1",
    name: "Org 1",
    billing: { plan: "free" },
  } as TOrganization;
  const project: TProject = {
    id: "proj1",
    name: "Project 1",
    config: { channel: "website" },
  } as TProject;
  const projects: TProject[] = [project, { ...project, id: "proj2", name: "Project 2" }];

  test("renders dropdown and project name", () => {
    render(
      <ProjectSwitcher
        isCollapsed={false}
        isTextVisible={false}
        organization={organization}
        project={project}
        projects={projects}
        organizationProjectsLimit={2}
        isFormbricksCloud={false}
        isLicenseActive={false}
        environmentId="env1"
        isOwnerOrManager={true}
      />
    );
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    expect(screen.getByTitle("Project 1")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-content")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-radio-group")).toBeInTheDocument();
    expect(screen.getAllByTestId("dropdown-radio-item").length).toBe(2);
  });

  test("opens ProjectLimitModal when project limit reached and add project is clicked", async () => {
    render(
      <ProjectSwitcher
        isCollapsed={false}
        isTextVisible={false}
        organization={organization}
        project={project}
        projects={projects}
        organizationProjectsLimit={2}
        isFormbricksCloud={false}
        isLicenseActive={false}
        environmentId="env1"
        isOwnerOrManager={true}
      />
    );
    const addButton = screen.getByText("common.add_project");
    await userEvent.click(addButton);
    expect(screen.getByTestId("project-limit-modal")).toBeInTheDocument();
  });

  test("closes ProjectLimitModal when close button is clicked", async () => {
    render(
      <ProjectSwitcher
        isCollapsed={false}
        isTextVisible={false}
        organization={organization}
        project={project}
        projects={projects}
        organizationProjectsLimit={2}
        isFormbricksCloud={false}
        isLicenseActive={false}
        environmentId="env1"
        isOwnerOrManager={true}
      />
    );
    const addButton = screen.getByText("common.add_project");
    await userEvent.click(addButton);
    const closeButton = screen.getByTestId("close-modal");
    await userEvent.click(closeButton);
    expect(screen.queryByTestId("project-limit-modal")).not.toBeInTheDocument();
  });

  test("renders correct modal buttons and project limit", async () => {
    render(
      <ProjectSwitcher
        isCollapsed={false}
        isTextVisible={false}
        organization={organization}
        project={project}
        projects={projects}
        organizationProjectsLimit={2}
        isFormbricksCloud={true}
        isLicenseActive={false}
        environmentId="env1"
        isOwnerOrManager={true}
      />
    );
    const addButton = screen.getByText("common.add_project");
    await userEvent.click(addButton);
    expect(screen.getByTestId("modal-buttons")).toHaveTextContent(
      "common.start_free_trial common.learn_more"
    );
    expect(screen.getByTestId("modal-project-limit")).toHaveTextContent("2");
  });

  test("handleAddProject navigates if under limit", async () => {
    render(
      <ProjectSwitcher
        isCollapsed={false}
        isTextVisible={false}
        organization={organization}
        project={project}
        projects={projects.slice(0, 1)}
        organizationProjectsLimit={2}
        isFormbricksCloud={false}
        isLicenseActive={false}
        environmentId="env1"
        isOwnerOrManager={true}
      />
    );
    const addButton = screen.getByText("common.add_project");
    await userEvent.click(addButton);
    expect(mockPush).toHaveBeenCalled();
  });
});
