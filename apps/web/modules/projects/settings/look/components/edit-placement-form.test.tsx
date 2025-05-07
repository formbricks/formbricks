import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
import { Project } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditPlacementForm } from "./edit-placement-form";

const baseProject: Project = {
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
  environments: [],
  languages: [],
  logo: null,
} as any;

vi.mock("@/modules/projects/settings/actions", () => ({
  updateProjectAction: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

describe("EditPlacementForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all placement radio buttons and save button", () => {
    render(<EditPlacementForm project={baseProject} environmentId="env1" isReadOnly={false} />);
    expect(screen.getByText("common.save")).toBeInTheDocument();
    expect(screen.getByLabelText("common.bottom_right")).toBeInTheDocument();
    expect(screen.getByLabelText("common.top_right")).toBeInTheDocument();
    expect(screen.getByLabelText("common.top_left")).toBeInTheDocument();
    expect(screen.getByLabelText("common.bottom_left")).toBeInTheDocument();
    expect(screen.getByLabelText("common.centered_modal")).toBeInTheDocument();
  });

  test("submits form and shows success toast", async () => {
    render(<EditPlacementForm project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.save"));
    expect(updateProjectAction).toHaveBeenCalled();
  });

  test("shows error toast if updateProjectAction returns no data", async () => {
    vi.mocked(updateProjectAction).mockResolvedValueOnce({ data: false } as any);
    render(<EditPlacementForm project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.save"));
    expect(getFormattedErrorMessage).toHaveBeenCalled();
  });

  test("shows error toast if updateProjectAction throws", async () => {
    vi.mocked(updateProjectAction).mockResolvedValueOnce({ data: false } as any);
    vi.mocked(getFormattedErrorMessage).mockReturnValueOnce("error");
    render(<EditPlacementForm project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.save"));
    expect(toast.error).toHaveBeenCalledWith("error");
  });

  test("renders overlay and disables save when isReadOnly", () => {
    render(<EditPlacementForm project={baseProject} environmentId="env1" isReadOnly={true} />);
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "common.only_owners_managers_and_manage_access_members_can_perform_this_action"
    );
    expect(screen.getByText("common.save")).toBeDisabled();
  });

  test("shows darkOverlay and clickOutsideClose options for centered modal", async () => {
    render(
      <EditPlacementForm
        project={{ ...baseProject, placement: "center", darkOverlay: true, clickOutsideClose: true }}
        environmentId="env1"
        isReadOnly={false}
      />
    );
    expect(screen.getByLabelText("common.light_overlay")).toBeInTheDocument();
    expect(screen.getByLabelText("common.dark_overlay")).toBeInTheDocument();
    expect(screen.getByLabelText("common.disallow")).toBeInTheDocument();
    expect(screen.getByLabelText("common.allow")).toBeInTheDocument();
  });

  test("changing placement to center shows overlay and clickOutsideClose options", async () => {
    render(<EditPlacementForm project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByLabelText("common.centered_modal"));
    expect(screen.getByLabelText("common.light_overlay")).toBeInTheDocument();
    expect(screen.getByLabelText("common.dark_overlay")).toBeInTheDocument();
    expect(screen.getByLabelText("common.disallow")).toBeInTheDocument();
    expect(screen.getByLabelText("common.allow")).toBeInTheDocument();
  });

  test("radio buttons are disabled when isReadOnly", () => {
    render(<EditPlacementForm project={baseProject} environmentId="env1" isReadOnly={true} />);
    expect(screen.getByLabelText("common.bottom_right")).toBeDisabled();
    expect(screen.getByLabelText("common.top_right")).toBeDisabled();
    expect(screen.getByLabelText("common.top_left")).toBeDisabled();
    expect(screen.getByLabelText("common.bottom_left")).toBeDisabled();
    expect(screen.getByLabelText("common.centered_modal")).toBeDisabled();
  });
});
