import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { EditWaitingTimeForm } from "./edit-waiting-time-form";

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

const mockUpdateProjectAction = vi.fn();
vi.mock("../../actions", () => ({
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
  recontactDays: 7,
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

describe("EditWaitingTimeForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders form with current waiting time and update button", () => {
    render(<EditWaitingTimeForm project={baseProject} isReadOnly={false} />);
    expect(
      screen.getByLabelText("environments.project.general.wait_x_days_before_showing_next_survey")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("7")).toBeInTheDocument();
    expect(screen.getByText("common.update")).toBeInTheDocument();
  });

  test("shows warning alert and disables input/button if isReadOnly", () => {
    render(<EditWaitingTimeForm project={baseProject} isReadOnly={true} />);
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "common.only_owners_managers_and_manage_access_members_can_perform_this_action"
    );
    expect(
      screen.getByLabelText("environments.project.general.wait_x_days_before_showing_next_survey")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("7")).toBeDisabled();
    expect(screen.getByText("common.update")).toBeDisabled();
  });

  test("calls updateProjectAction and shows success toast on valid submit", async () => {
    mockUpdateProjectAction.mockResolvedValue({ data: { recontactDays: 10 } });
    render(<EditWaitingTimeForm project={baseProject} isReadOnly={false} />);
    const input = screen.getByLabelText(
      "environments.project.general.wait_x_days_before_showing_next_survey"
    );
    await userEvent.clear(input);
    await userEvent.type(input, "10");
    await userEvent.click(screen.getByText("common.update"));
    expect(mockUpdateProjectAction).toHaveBeenCalledWith({ projectId: "p1", data: { recontactDays: 10 } });
    expect(toast.success).toHaveBeenCalledWith(
      "environments.project.general.waiting_period_updated_successfully"
    );
  });

  test("shows error toast if updateProjectAction returns no data", async () => {
    mockUpdateProjectAction.mockResolvedValue({ data: null });
    render(<EditWaitingTimeForm project={baseProject} isReadOnly={false} />);
    const input = screen.getByLabelText(
      "environments.project.general.wait_x_days_before_showing_next_survey"
    );
    await userEvent.clear(input);
    await userEvent.type(input, "5");
    await userEvent.click(screen.getByText("common.update"));
    expect(toast.error).toHaveBeenCalledWith("error-message");
  });

  test("shows error toast if updateProjectAction throws", async () => {
    mockUpdateProjectAction.mockRejectedValue(new Error("fail"));
    render(<EditWaitingTimeForm project={baseProject} isReadOnly={false} />);
    const input = screen.getByLabelText(
      "environments.project.general.wait_x_days_before_showing_next_survey"
    );
    await userEvent.clear(input);
    await userEvent.type(input, "3");
    await userEvent.click(screen.getByText("common.update"));
    expect(toast.error).toHaveBeenCalledWith("Error: fail");
  });
});
