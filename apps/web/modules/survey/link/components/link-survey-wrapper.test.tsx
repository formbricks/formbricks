import { SurveyType } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LinkSurveyWrapper } from "./link-survey-wrapper";

// Mock child components
vi.mock("@/modules/survey/link/components/legal-footer", () => ({
  LegalFooter: ({ surveyUrl }: { surveyUrl: string }) => <div data-testid="legal-footer">{surveyUrl}</div>,
}));

vi.mock("@/modules/survey/link/components/survey-loading-animation", () => ({
  SurveyLoadingAnimation: ({
    isWelcomeCardEnabled,
    isBackgroundLoaded,
    isBrandingEnabled,
  }: {
    isWelcomeCardEnabled: boolean;
    isBackgroundLoaded?: boolean;
    isBrandingEnabled: boolean;
  }) => (
    <div data-testid="survey-loading-animation">
      Loading: {isWelcomeCardEnabled ? "welcome" : "no-welcome"}, {isBackgroundLoaded ? "loaded" : "loading"},{" "}
      {isBrandingEnabled ? "branded" : "unbranded"}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/client-logo", () => ({
  ClientLogo: ({ projectLogo }: { projectLogo: { url: string } }) => (
    <div data-testid="client-logo">{projectLogo.url}</div>
  ),
}));

vi.mock("@/modules/ui/components/media-background", () => ({
  MediaBackground: ({
    children,
    onBackgroundLoaded,
  }: {
    children: React.ReactNode;
    onBackgroundLoaded: (isLoaded: boolean) => void;
  }) => {
    // Simulate the background loading
    setTimeout(() => onBackgroundLoaded(true), 0);
    return <div data-testid="media-background">{children}</div>;
  },
}));

vi.mock("@/modules/ui/components/reset-progress-button", () => ({
  ResetProgressButton: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="reset-button" onClick={onClick}>
      Reset
    </button>
  ),
}));

describe("LinkSurveyWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    children: <div data-testid="survey-content">Survey Content</div>,
    project: {
      styling: {},
      logo: { url: "https://example.com/logo.png" },
      linkSurveyBranding: true,
    },
    isWelcomeCardEnabled: true,
    surveyId: "survey123",
    surveyType: SurveyType.link,
    isPreview: false,
    isEmbed: false,
    determineStyling: () => ({
      cardArrangement: {
        linkSurveys: "casual",
      },
      isLogoHidden: false,
    }),
    handleResetSurvey: vi.fn(),
    IMPRINT_URL: "https://imprint.url",
    PRIVACY_URL: "https://privacy.url",
    IS_FORMBRICKS_CLOUD: true,
    surveyDomain: "https://survey.domain",
    isBrandingEnabled: true,
  } as any;

  test("renders embedded survey correctly", () => {
    render(<LinkSurveyWrapper {...defaultProps} isEmbed={true} />);

    expect(screen.getByTestId("survey-loading-animation")).toBeInTheDocument();
    expect(screen.getByTestId("survey-content")).toBeInTheDocument();
    expect(screen.getByTestId("survey-loading-animation")).toHaveTextContent("welcome");
    expect(screen.getByTestId("survey-loading-animation")).toHaveTextContent("branded");

    // Check the correct styling is applied
    const containerDiv = screen.getByTestId("survey-content").parentElement;
    expect(containerDiv).toHaveClass("px-6 py-10");
  });

  test("renders non-embedded survey correctly", () => {
    render(<LinkSurveyWrapper {...defaultProps} />);

    expect(screen.getByTestId("survey-loading-animation")).toBeInTheDocument();
    expect(screen.getByTestId("media-background")).toBeInTheDocument();
    expect(screen.getByTestId("client-logo")).toBeInTheDocument();
    expect(screen.getByTestId("survey-content")).toBeInTheDocument();
    expect(screen.getByTestId("legal-footer")).toBeInTheDocument();
    expect(screen.getByTestId("legal-footer")).toHaveTextContent("https://survey.domain/s/survey123");
  });

  test("handles background loaded state correctly", async () => {
    render(<LinkSurveyWrapper {...defaultProps} />);

    // Initially the loading animation should show as not loaded
    expect(screen.getByTestId("survey-loading-animation")).toHaveTextContent("loading");

    // Wait for the mocked background to trigger the loaded callback
    await vi.waitFor(() => {
      expect(screen.getByTestId("survey-loading-animation")).toHaveTextContent("loaded");
    });
  });

  test("renders preview mode with reset button", async () => {
    const resetSurveyMock = vi.fn();
    const user = userEvent.setup();

    render(<LinkSurveyWrapper {...defaultProps} isPreview={true} handleResetSurvey={resetSurveyMock} />);

    expect(screen.getByText("Survey Preview 👀")).toBeInTheDocument();
    expect(screen.getByTestId("reset-button")).toBeInTheDocument();

    await user.click(screen.getByTestId("reset-button"));
    expect(resetSurveyMock).toHaveBeenCalledTimes(1);
  });

  test("hides logo when isLogoHidden is true", () => {
    render(
      <LinkSurveyWrapper
        {...defaultProps}
        determineStyling={() => ({
          cardArrangement: {
            linkSurveys: "casual",
          },
          isLogoHidden: true,
        })}
      />
    );

    expect(screen.queryByTestId("client-logo")).not.toBeInTheDocument();
  });

  test("applies straight card arrangement styling", () => {
    render(
      <LinkSurveyWrapper
        {...defaultProps}
        isEmbed={true}
        determineStyling={() => ({
          cardArrangement: {
            linkSurveys: "straight",
          },
          isLogoHidden: false,
        })}
      />
    );

    const containerDiv = screen.getByTestId("survey-content").parentElement;
    expect(containerDiv).toHaveClass("pt-6");
    expect(containerDiv).not.toHaveClass("px-6 py-10");
  });

  test("hides logo when project has no logo", () => {
    render(
      <LinkSurveyWrapper
        {...defaultProps}
        project={{
          styling: {},
          logo: undefined,
          linkSurveyBranding: true,
        }}
      />
    );

    expect(screen.queryByTestId("client-logo")).not.toBeInTheDocument();
  });
});
