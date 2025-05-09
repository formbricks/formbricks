import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ThemeStylingPreviewSurvey } from "./index";

// Mock required components
vi.mock("@/modules/ui/components/client-logo", () => ({
  ClientLogo: ({ projectLogo, previewSurvey }: any) => (
    <div data-testid="client-logo" data-preview={previewSurvey ? "true" : "false"}>
      {projectLogo?.url ? "Logo" : "No Logo"}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/media-background", () => ({
  MediaBackground: ({ children, isEditorView }: any) => (
    <div data-testid="media-background" data-editor={isEditorView ? "true" : "false"}>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/preview-survey/components/modal", () => ({
  Modal: ({ children, isOpen, placement, darkOverlay, clickOutsideClose, previewMode }: any) => (
    <div
      data-testid="preview-modal"
      data-open={isOpen ? "true" : "false"}
      data-placement={placement}
      data-dark-overlay={darkOverlay ? "true" : "false"}
      data-click-outside-close={clickOutsideClose ? "true" : "false"}
      data-preview-mode={previewMode}>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/reset-progress-button", () => ({
  ResetProgressButton: ({ onClick }: any) => (
    <button data-testid="reset-progress-button" onClick={onClick}>
      Reset Progress
    </button>
  ),
}));

vi.mock("@/modules/ui/components/survey", () => ({
  SurveyInline: ({ survey, isPreviewMode, isBrandingEnabled, languageCode }: any) => (
    <div
      data-testid="survey-inline"
      data-preview-mode={isPreviewMode ? "true" : "false"}
      data-survey-type={survey.type}
      data-branding-enabled={isBrandingEnabled ? "true" : "false"}
      data-language={languageCode}>
      Survey Content
    </div>
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    motion: {
      div: ({ children, className, animate }: any) => (
        <div data-testid="motion-div" data-animate={animate} className={className}>
          {children}
        </div>
      ),
    },
  };
});

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.link_survey": "Link Survey",
        "common.app_survey": "App Survey",
      };
      return translations[key] || key;
    },
  }),
}));

describe("ThemeStylingPreviewSurvey", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSurvey: TSurvey = {
    id: "survey1",
    name: "Test Survey",
    type: "link",
    environmentId: "env1",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    languages: {},
    projectOverwrites: {
      placement: "bottomRight",
      darkOverlay: true,
      clickOutsideClose: true,
    },
  } as TSurvey;

  const mockProject = {
    id: "project1",
    name: "Test Project",
    placement: "center",
    darkOverlay: false,
    clickOutsideClose: false,
    inAppSurveyBranding: true,
    linkSurveyBranding: true,
    logo: { url: "http://example.com/logo.png" },
    styling: {
      roundness: 8,
      cardBackgroundColor: { light: "#ffffff" },
      isLogoHidden: false,
    },
  } as any;

  test("renders correctly with link survey type", () => {
    const setPreviewType = vi.fn();

    render(
      <ThemeStylingPreviewSurvey
        survey={mockSurvey}
        project={mockProject}
        previewType="link"
        setPreviewType={setPreviewType}
      />
    );

    // Check if browser header elements are rendered
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByTestId("reset-progress-button")).toBeInTheDocument();

    // Check if MediaBackground is rendered for link survey
    const mediaBackground = screen.getByTestId("media-background");
    expect(mediaBackground).toBeInTheDocument();
    expect(mediaBackground).toHaveAttribute("data-editor", "true");

    // Check if ClientLogo is rendered
    const clientLogo = screen.getByTestId("client-logo");
    expect(clientLogo).toBeInTheDocument();
    expect(clientLogo).toHaveAttribute("data-preview", "true");

    // Check if SurveyInline is rendered with correct props
    const surveyInline = screen.getByTestId("survey-inline");
    expect(surveyInline).toBeInTheDocument();
    expect(surveyInline).toHaveAttribute("data-survey-type", "link");
    expect(surveyInline).toHaveAttribute("data-preview-mode", "true");
    expect(surveyInline).toHaveAttribute("data-branding-enabled", "true");

    // Check if toggle buttons are rendered
    expect(screen.getByText("Link Survey")).toBeInTheDocument();
    expect(screen.getByText("App Survey")).toBeInTheDocument();
  });

  test("renders correctly with app survey type", () => {
    const setPreviewType = vi.fn();

    render(
      <ThemeStylingPreviewSurvey
        survey={{ ...mockSurvey, type: "app" }}
        project={mockProject}
        previewType="app"
        setPreviewType={setPreviewType}
      />
    );

    // Check if browser header elements are rendered
    expect(screen.getByText("Your web app")).toBeInTheDocument();
    expect(screen.getByTestId("reset-progress-button")).toBeInTheDocument();

    // Check if Modal is rendered for app survey
    const previewModal = screen.getByTestId("preview-modal");
    expect(previewModal).toBeInTheDocument();
    expect(previewModal).toHaveAttribute("data-open", "true");
    expect(previewModal).toHaveAttribute("data-placement", "bottomRight");
    expect(previewModal).toHaveAttribute("data-dark-overlay", "true");
    expect(previewModal).toHaveAttribute("data-click-outside-close", "true");
    expect(previewModal).toHaveAttribute("data-preview-mode", "desktop");

    // Check if SurveyInline is rendered with correct props
    const surveyInline = screen.getByTestId("survey-inline");
    expect(surveyInline).toBeInTheDocument();
    expect(surveyInline).toHaveAttribute("data-survey-type", "app");
    expect(surveyInline).toHaveAttribute("data-preview-mode", "true");
    expect(surveyInline).toHaveAttribute("data-branding-enabled", "true");
  });

  test("handles toggle between link and app survey types", async () => {
    const setPreviewType = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeStylingPreviewSurvey
        survey={mockSurvey}
        project={mockProject}
        previewType="link"
        setPreviewType={setPreviewType}
      />
    );

    // Click on App Survey button
    await user.click(screen.getByText("App Survey"));

    // Check if setPreviewType was called with "app"
    expect(setPreviewType).toHaveBeenCalledWith("app");

    // Clean up and reset
    cleanup();
    setPreviewType.mockClear();

    // Render with app type
    render(
      <ThemeStylingPreviewSurvey
        survey={mockSurvey}
        project={mockProject}
        previewType="app"
        setPreviewType={setPreviewType}
      />
    );

    // Click on Link Survey button
    await user.click(screen.getByText("Link Survey"));

    // Check if setPreviewType was called with "link"
    expect(setPreviewType).toHaveBeenCalledWith("link");
  });

  test("handles reset progress button click", async () => {
    const setPreviewType = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeStylingPreviewSurvey
        survey={mockSurvey}
        project={mockProject}
        previewType="link"
        setPreviewType={setPreviewType}
      />
    );

    // Click the reset progress button
    await user.click(screen.getByTestId("reset-progress-button"));

    // Check if a new survey component renders with a new key
    // Since we can't easily check the key directly, we can verify the content is still there
    expect(screen.getByTestId("survey-inline")).toBeInTheDocument();
  });

  test("renders without logo when isLogoHidden is true", () => {
    const setPreviewType = vi.fn();
    const projectWithHiddenLogo = {
      ...mockProject,
      styling: {
        ...mockProject.styling,
        isLogoHidden: true,
      },
    };

    render(
      <ThemeStylingPreviewSurvey
        survey={mockSurvey}
        project={projectWithHiddenLogo}
        previewType="link"
        setPreviewType={setPreviewType}
      />
    );

    // Check that the logo is not rendered
    expect(screen.queryByTestId("client-logo")).not.toBeInTheDocument();
  });

  test("uses project settings when projectOverwrites are not provided", () => {
    const setPreviewType = vi.fn();
    const surveyWithoutOverwrites = {
      ...mockSurvey,
      projectOverwrites: undefined,
    };

    render(
      <ThemeStylingPreviewSurvey
        survey={surveyWithoutOverwrites as unknown as TSurvey}
        project={mockProject}
        previewType="app"
        setPreviewType={setPreviewType}
      />
    );

    // Check if Modal uses project settings
    const previewModal = screen.getByTestId("preview-modal");
    expect(previewModal).toHaveAttribute("data-placement", "center");
    expect(previewModal).toHaveAttribute("data-dark-overlay", "false");
    expect(previewModal).toHaveAttribute("data-click-outside-close", "false");
  });
});
