import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { DeleteProjectRender } from "./delete-project-render";

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, setOpen, onDelete, text, isDeleting }: any) =>
    open ? (
      <div data-testid="delete-dialog">
        <span>{text}</span>
        <button onClick={onDelete} disabled={isDeleting} data-testid="confirm-delete">
          Delete
        </button>
        <button onClick={() => setOpen(false)} data-testid="cancel-delete">
          Cancel
        </button>
      </div>
    ) : null,
}));
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: any) => (params?.projectName ? `${key} ${params.projectName}` : key),
  }),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(() => "error-message"),
}));
vi.mock("@/lib/utils/strings", () => ({
  truncate: (str: string) => str,
}));

const mockDeleteProjectAction = vi.fn();
vi.mock("@/modules/projects/settings/general/actions", () => ({
  deleteProjectAction: (...args: any[]) => mockDeleteProjectAction(...args),
}));

const mockLocalStorage = {
  removeItem: vi.fn(),
  setItem: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

const baseProject: TProject = {
  id: "p1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Project 1",
  organizationId: "org1",
  styling: { allowStyleOverwrite: true },
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  config: { channel: null, industry: null },
  placement: "bottomRight",
  clickOutsideClose: false,
  darkOverlay: false,
  environments: [
    {
      id: "env1",
      type: "production",
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "p1",
      appSetupCompleted: false,
    },
  ],
  languages: [],
  logo: null,
};

describe("DeleteProjectRender", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows delete button and dialog when enabled", async () => {
    render(
      <DeleteProjectRender
        isDeleteDisabled={false}
        isOwnerOrManager={true}
        currentProject={baseProject}
        organizationProjects={[baseProject]}
      />
    );
    expect(
      screen.getByText(
        "environments.project.general.delete_project_name_includes_surveys_responses_people_and_more Project 1"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("environments.project.general.this_action_cannot_be_undone")).toBeInTheDocument();
    const deleteBtn = screen.getByText("common.delete");
    expect(deleteBtn).toBeInTheDocument();
    await userEvent.click(deleteBtn);
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
  });

  test("shows alert if delete is disabled and not owner/manager", () => {
    render(
      <DeleteProjectRender
        isDeleteDisabled={true}
        isOwnerOrManager={false}
        currentProject={baseProject}
        organizationProjects={[baseProject]}
      />
    );
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "environments.project.general.only_owners_or_managers_can_delete_projects"
    );
  });

  test("shows alert if delete is disabled and is owner/manager", () => {
    render(
      <DeleteProjectRender
        isDeleteDisabled={true}
        isOwnerOrManager={true}
        currentProject={baseProject}
        organizationProjects={[baseProject]}
      />
    );
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "environments.project.general.cannot_delete_only_project"
    );
  });

  test("successful delete with one project removes env id and redirects", async () => {
    mockDeleteProjectAction.mockResolvedValue({ data: true });
    render(
      <DeleteProjectRender
        isDeleteDisabled={false}
        isOwnerOrManager={true}
        currentProject={baseProject}
        organizationProjects={[baseProject]}
      />
    );
    await userEvent.click(screen.getByText("common.delete"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("environments.project.general.project_deleted_successfully");
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  test("successful delete with multiple projects sets env id and redirects", async () => {
    const otherProject: TProject = {
      ...baseProject,
      id: "p2",
      environments: [{ ...baseProject.environments[0], id: "env2" }],
    };
    mockDeleteProjectAction.mockResolvedValue({ data: true });
    render(
      <DeleteProjectRender
        isDeleteDisabled={false}
        isOwnerOrManager={true}
        currentProject={baseProject}
        organizationProjects={[baseProject, otherProject]}
      />
    );
    await userEvent.click(screen.getByText("common.delete"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith("formbricks-environment-id", "env2");
    expect(toast.success).toHaveBeenCalledWith("environments.project.general.project_deleted_successfully");
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  test("delete error shows error toast and closes dialog", async () => {
    mockDeleteProjectAction.mockResolvedValue({ data: false });
    render(
      <DeleteProjectRender
        isDeleteDisabled={false}
        isOwnerOrManager={true}
        currentProject={baseProject}
        organizationProjects={[baseProject]}
      />
    );
    await userEvent.click(screen.getByText("common.delete"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(toast.error).toHaveBeenCalledWith("error-message");
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
  });
});
