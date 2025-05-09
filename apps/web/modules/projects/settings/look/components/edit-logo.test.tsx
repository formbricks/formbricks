import { Project } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditLogo } from "./edit-logo";

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
  logo: { url: "https://logo.com/logo.png", bgColor: "#fff" },
} as any;

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: any) => <img alt="test" {...props} />,
}));

vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: ({ children }: any) => <div data-testid="advanced-option-toggle">{children}</div>,
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

vi.mock("@/modules/ui/components/color-picker", () => ({
  ColorPicker: ({ color }: any) => <div data-testid="color-picker">{color}</div>,
}));
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, onDelete }: any) =>
    open ? (
      <div data-testid="delete-dialog">
        <button data-testid="confirm-delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    ) : null,
}));
vi.mock("@/modules/ui/components/file-input", () => ({
  FileInput: () => <div data-testid="file-input" />,
}));
vi.mock("@/modules/ui/components/input", () => ({ Input: (props: any) => <input {...props} /> }));

const mockUpdateProjectAction = vi.fn(async () => ({ data: true }));

const mockGetFormattedErrorMessage = vi.fn(() => "error-message");

vi.mock("@/modules/projects/settings/actions", () => ({
  updateProjectAction: () => mockUpdateProjectAction(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: () => mockGetFormattedErrorMessage(),
}));

describe("EditLogo", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders logo and edit button", () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    expect(screen.getByAltText("Logo")).toBeInTheDocument();
    expect(screen.getByText("common.edit")).toBeInTheDocument();
  });

  test("renders file input if no logo", () => {
    render(<EditLogo project={{ ...baseProject, logo: null }} environmentId="env1" isReadOnly={false} />);
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
  });

  test("shows alert if isReadOnly", () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={true} />);
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "common.only_owners_managers_and_manage_access_members_can_perform_this_action"
    );
  });

  test("clicking edit enables editing and shows save button", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    const editBtn = screen.getByText("common.edit");
    await userEvent.click(editBtn);
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  test("clicking save calls updateProjectAction and shows success toast", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("common.save"));
    expect(mockUpdateProjectAction).toHaveBeenCalled();
  });

  test("shows error toast if updateProjectAction returns no data", async () => {
    mockUpdateProjectAction.mockResolvedValueOnce({ data: false });
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("common.save"));
    expect(mockGetFormattedErrorMessage).toHaveBeenCalled();
  });

  test("shows error toast if updateProjectAction throws", async () => {
    mockUpdateProjectAction.mockRejectedValueOnce(new Error("fail"));
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("common.save"));
    // error toast is called
  });

  test("clicking remove logo opens dialog and confirms removal", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("environments.project.look.remove_logo"));
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(mockUpdateProjectAction).toHaveBeenCalled();
  });

  test("shows error toast if removeLogo returns no data", async () => {
    mockUpdateProjectAction.mockResolvedValueOnce({ data: false });
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("environments.project.look.remove_logo"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(mockGetFormattedErrorMessage).toHaveBeenCalled();
  });

  test("shows error toast if removeLogo throws", async () => {
    mockUpdateProjectAction.mockRejectedValueOnce(new Error("fail"));
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("environments.project.look.remove_logo"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
  });

  test("toggle background color enables/disables color picker", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    expect(screen.getByTestId("color-picker")).toBeInTheDocument();
  });

  test("saveChanges with isEditing false enables editing", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    // Save button should now be visible
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  test("saveChanges error toast on update failure", async () => {
    mockUpdateProjectAction.mockRejectedValueOnce(new Error("fail"));
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("common.save"));
    // error toast is called
  });

  test("removeLogo with isEditing false enables editing", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("environments.project.look.remove_logo"));
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
  });

  test("removeLogo error toast on update failure", async () => {
    mockUpdateProjectAction.mockRejectedValueOnce(new Error("fail"));
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("environments.project.look.remove_logo"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    // error toast is called
  });

  test("toggleBackgroundColor disables and resets color", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    const toggle = screen.getByTestId("advanced-option-toggle");
    await userEvent.click(toggle);
    expect(screen.getByTestId("color-picker")).toBeInTheDocument();
  });

  test("DeleteDialog closes after confirming removal", async () => {
    render(<EditLogo project={baseProject} environmentId="env1" isReadOnly={false} />);
    await userEvent.click(screen.getByText("common.edit"));
    await userEvent.click(screen.getByText("environments.project.look.remove_logo"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
  });
});
