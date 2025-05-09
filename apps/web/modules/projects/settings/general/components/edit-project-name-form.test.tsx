import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { anyString } from "vitest-mock-extended";
import { TProject } from "@formbricks/types/project";
import { EditProjectNameForm } from "./edit-project-name-form";

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

const mockUpdateProjectAction = vi.fn();
vi.mock("@/modules/projects/settings/actions", () => ({
  updateProjectAction: (...args: any[]) => mockUpdateProjectAction(...args),
}));
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(() => "error-message"),
}));

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

describe("EditProjectNameForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders form with project name and update button", () => {
    render(<EditProjectNameForm project={baseProject} isReadOnly={false} />);
    expect(
      screen.getByLabelText("environments.project.general.whats_your_project_called")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("common.project_name")).toHaveValue("Project 1");
    expect(screen.getByText("common.update")).toBeInTheDocument();
  });

  test("shows warning alert if isReadOnly", () => {
    render(<EditProjectNameForm project={baseProject} isReadOnly={true} />);
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "common.only_owners_managers_and_manage_access_members_can_perform_this_action"
    );
    expect(
      screen.getByLabelText("environments.project.general.whats_your_project_called")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("common.project_name")).toBeDisabled();
    expect(screen.getByText("common.update")).toBeDisabled();
  });

  test("calls updateProjectAction and shows success toast on valid submit", async () => {
    mockUpdateProjectAction.mockResolvedValue({ data: { name: "New Name" } });
    render(<EditProjectNameForm project={baseProject} isReadOnly={false} />);
    const input = screen.getByPlaceholderText("common.project_name");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.click(screen.getByText("common.update"));
    expect(mockUpdateProjectAction).toHaveBeenCalledWith({ projectId: "p1", data: { name: "New Name" } });
    expect(toast.success).toHaveBeenCalled();
  });

  test("shows error toast if updateProjectAction returns no data", async () => {
    mockUpdateProjectAction.mockResolvedValue({ data: null });
    render(<EditProjectNameForm project={baseProject} isReadOnly={false} />);
    const input = screen.getByPlaceholderText("common.project_name");
    await userEvent.clear(input);
    await userEvent.type(input, "Another Name");
    await userEvent.click(screen.getByText("common.update"));
    expect(toast.error).toHaveBeenCalledWith(anyString());
  });

  test("shows error toast if updateProjectAction throws", async () => {
    mockUpdateProjectAction.mockRejectedValue(new Error("fail"));
    render(<EditProjectNameForm project={baseProject} isReadOnly={false} />);
    const input = screen.getByPlaceholderText("common.project_name");
    await userEvent.clear(input);
    await userEvent.type(input, "Error Name");
    await userEvent.click(screen.getByText("common.update"));
    expect(toast.error).toHaveBeenCalledWith("environments.project.general.error_saving_project_information");
  });
});
