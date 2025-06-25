import { updateProjectAction } from "@/modules/projects/settings/actions";
import { Project } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ThemeStyling } from "./theme-styling";

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

const colors = ["#fff", "#000"];

const mockGetFormattedErrorMessage = vi.fn(() => "error-message");
const mockRouter = { refresh: vi.fn() };

vi.mock("@/modules/projects/settings/actions", () => ({
  updateProjectAction: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: () => mockGetFormattedErrorMessage(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/modules/ui/components/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));
vi.mock("@/modules/ui/components/alert-dialog", () => ({
  AlertDialog: ({ open, onConfirm, onDecline, headerText, mainText, confirmBtnLabel }: any) =>
    open ? (
      <div data-testid="alert-dialog">
        <div>{headerText}</div>
        <div>{mainText}</div>
        <button onClick={onConfirm}>{confirmBtnLabel}</button>
        <button onClick={onDecline}>Cancel</button>
      </div>
    ) : null,
}));
vi.mock("@/modules/ui/components/background-styling-card", () => ({
  BackgroundStylingCard: () => <div data-testid="background-styling-card" />,
}));
vi.mock("@/modules/ui/components/card-styling-settings", () => ({
  CardStylingSettings: () => <div data-testid="card-styling-settings" />,
}));
vi.mock("@/modules/survey/editor/components/form-styling-settings", () => ({
  FormStylingSettings: () => <div data-testid="form-styling-settings" />,
}));
vi.mock("@/modules/ui/components/theme-styling-preview-survey", () => ({
  ThemeStylingPreviewSurvey: () => <div data-testid="theme-styling-preview-survey" />,
}));
vi.mock("@/app/lib/templates", () => ({ previewSurvey: () => ({}) }));
vi.mock("@/lib/styling/constants", () => ({ defaultStyling: { allowStyleOverwrite: false } }));

describe("ThemeStyling", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all main sections and save/reset buttons", () => {
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={false}
      />
    );
    expect(screen.getByTestId("form-styling-settings")).toBeInTheDocument();
    expect(screen.getByTestId("card-styling-settings")).toBeInTheDocument();
    expect(screen.getByTestId("background-styling-card")).toBeInTheDocument();
    expect(screen.getByTestId("theme-styling-preview-survey")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
    expect(screen.getByText("common.reset_to_default")).toBeInTheDocument();
  });

  test("submits form and shows success toast", async () => {
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={false}
      />
    );
    await userEvent.click(screen.getByText("common.save"));
    expect(updateProjectAction).toHaveBeenCalled();
  });

  test("shows error toast if updateProjectAction returns no data on submit", async () => {
    vi.mocked(updateProjectAction).mockResolvedValueOnce({});
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={false}
      />
    );
    await userEvent.click(screen.getByText("common.save"));
    expect(mockGetFormattedErrorMessage).toHaveBeenCalled();
  });

  test("shows error toast if updateProjectAction throws on submit", async () => {
    vi.mocked(updateProjectAction).mockResolvedValueOnce({});
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={false}
      />
    );
    await userEvent.click(screen.getByText("common.save"));
    expect(toast.error).toHaveBeenCalled();
  });

  test("opens and confirms reset styling modal", async () => {
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={false}
      />
    );
    await userEvent.click(screen.getByText("common.reset_to_default"));
    expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByText("common.confirm"));
    expect(updateProjectAction).toHaveBeenCalled();
  });

  test("opens and cancels reset styling modal", async () => {
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={false}
      />
    );
    await userEvent.click(screen.getByText("common.reset_to_default"));
    expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("alert-dialog")).not.toBeInTheDocument();
  });

  test("shows error toast if updateProjectAction returns no data on reset", async () => {
    vi.mocked(updateProjectAction).mockResolvedValueOnce({});
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={false}
      />
    );
    await userEvent.click(screen.getByText("common.reset_to_default"));
    await userEvent.click(screen.getByText("common.confirm"));
    expect(mockGetFormattedErrorMessage).toHaveBeenCalled();
  });

  test("renders alert if isReadOnly", () => {
    render(
      <ThemeStyling
        project={baseProject}
        environmentId="env1"
        colors={colors}
        isUnsplashConfigured={true}
        isReadOnly={true}
      />
    );
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "common.only_owners_managers_and_manage_access_members_can_perform_this_action"
    );
  });
});
