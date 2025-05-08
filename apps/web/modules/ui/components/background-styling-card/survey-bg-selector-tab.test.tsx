import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SurveyBgSelectorTab } from "./survey-bg-selector-tab";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  POSTHOG_API_KEY: "mock-posthog-api-key",
  POSTHOG_HOST: "mock-posthog-host",
  IS_POSTHOG_CONFIGURED: true,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
}));

// Mock the dependencies
vi.mock("@/modules/survey/editor/components/color-survey-bg", () => ({
  ColorSurveyBg: ({ handleBgChange, colors, background }) => (
    <div data-testid="color-survey-bg" data-background={background} data-colors={colors.join(",")}>
      <button onClick={() => handleBgChange("#FF5500", "color")} data-testid="color-select-button">
        Select Color
      </button>
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/animated-survey-bg", () => ({
  AnimatedSurveyBg: ({ handleBgChange, background }) => (
    <div data-testid="animated-survey-bg" data-background={background}>
      <button onClick={() => handleBgChange("animation1", "animation")} data-testid="animation-select-button">
        Select Animation
      </button>
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/image-survey-bg", () => ({
  UploadImageSurveyBg: ({ handleBgChange, background, environmentId }) => (
    <div data-testid="upload-survey-bg" data-background={background} data-environment-id={environmentId}>
      <button onClick={() => handleBgChange("image-url.jpg", "upload")} data-testid="upload-select-button">
        Select Upload
      </button>
    </div>
  ),
}));

// Mock the ImageFromUnsplashSurveyBg component to match its actual implementation
vi.mock("@/modules/survey/editor/components/unsplash-images", () => ({
  ImageFromUnsplashSurveyBg: ({ handleBgChange }) => (
    <div data-testid="unsplash-survey-bg" className="relative mt-2 w-full">
      <div className="relative">
        <input
          aria-label="Search for images"
          className="pl-8"
          placeholder="Try lollipop or mountain"
          data-testid="unsplash-search-input"
        />
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-1">
        <div className="group relative">
          <img
            width={300}
            height={200}
            src="/image-backgrounds/dogs.webp"
            alt="Dog"
            onClick={() => handleBgChange("/image-backgrounds/dogs.webp", "image")}
            className="h-full cursor-pointer rounded-lg object-cover"
            data-testid="unsplash-select-button"
          />
        </div>
      </div>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/tab-bar", () => ({
  TabBar: ({ tabs, activeId, setActiveId }) => (
    <div data-testid="tab-bar" data-active-tab={activeId}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          data-testid={`tab-${tab.id}`}
          data-label={tab.label}
          onClick={() => setActiveId(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

describe("SurveyBgSelectorTab", () => {
  const mockHandleBgChange = vi.fn();
  const mockColors = ["#FF0000", "#00FF00", "#0000FF"];
  const mockEnvironmentId = "env-123";
  const defaultProps = {
    handleBgChange: mockHandleBgChange,
    colors: mockColors,
    bgType: "color",
    bg: "#FF0000",
    environmentId: mockEnvironmentId,
    isUnsplashConfigured: true,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders TabBar with correct tabs when Unsplash is configured", () => {
    render(<SurveyBgSelectorTab {...defaultProps} />);

    const tabBar = screen.getByTestId("tab-bar");
    expect(tabBar).toBeInTheDocument();
    expect(tabBar).toHaveAttribute("data-active-tab", "color");

    const colorTab = screen.getByTestId("tab-color");
    const animationTab = screen.getByTestId("tab-animation");
    const uploadTab = screen.getByTestId("tab-upload");
    const imageTab = screen.getByTestId("tab-image");

    expect(colorTab).toBeInTheDocument();
    expect(animationTab).toBeInTheDocument();
    expect(uploadTab).toBeInTheDocument();
    expect(imageTab).toBeInTheDocument();
  });

  test("does not render image tab when Unsplash is not configured", () => {
    render(<SurveyBgSelectorTab {...defaultProps} isUnsplashConfigured={false} />);

    expect(screen.queryByTestId("tab-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-color")).toBeInTheDocument();
    expect(screen.getByTestId("tab-animation")).toBeInTheDocument();
    expect(screen.getByTestId("tab-upload")).toBeInTheDocument();
  });

  test("renders ColorSurveyBg component when color tab is active", () => {
    render(<SurveyBgSelectorTab {...defaultProps} bgType="color" bg="#FF0000" />);

    const colorComponent = screen.getByTestId("color-survey-bg");
    expect(colorComponent).toBeInTheDocument();
    expect(colorComponent).toHaveAttribute("data-background", "#FF0000");
    expect(colorComponent).toHaveAttribute("data-colors", mockColors.join(","));

    expect(screen.queryByTestId("animated-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("unsplash-survey-bg")).not.toBeInTheDocument();
  });

  test("renders AnimatedSurveyBg component when animation tab is active", async () => {
    const user = userEvent.setup();
    render(<SurveyBgSelectorTab {...defaultProps} />);

    await user.click(screen.getByTestId("tab-animation"));

    const animationComponent = screen.getByTestId("animated-survey-bg");
    expect(animationComponent).toBeInTheDocument();
    expect(animationComponent).toHaveAttribute("data-background", "");

    expect(screen.queryByTestId("color-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("unsplash-survey-bg")).not.toBeInTheDocument();
  });

  test("renders UploadImageSurveyBg component when upload tab is active", async () => {
    const user = userEvent.setup();
    render(<SurveyBgSelectorTab {...defaultProps} />);

    await user.click(screen.getByTestId("tab-upload"));

    const uploadComponent = screen.getByTestId("upload-survey-bg");
    expect(uploadComponent).toBeInTheDocument();
    expect(uploadComponent).toHaveAttribute("data-background", "");
    expect(uploadComponent).toHaveAttribute("data-environment-id", mockEnvironmentId);

    expect(screen.queryByTestId("color-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("animated-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("unsplash-survey-bg")).not.toBeInTheDocument();
  });

  test("renders ImageFromUnsplashSurveyBg component when image tab is active and Unsplash is configured", async () => {
    const user = userEvent.setup();
    render(<SurveyBgSelectorTab {...defaultProps} />);

    await user.click(screen.getByTestId("tab-image"));

    const unsplashComponent = screen.getByTestId("unsplash-survey-bg");
    expect(unsplashComponent).toBeInTheDocument();

    expect(screen.queryByTestId("color-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("animated-survey-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-survey-bg")).not.toBeInTheDocument();
  });

  test("does not render unsplash component when image tab is active but Unsplash is not configured", () => {
    render(<SurveyBgSelectorTab {...defaultProps} isUnsplashConfigured={false} />);

    const tabBar = screen.getByTestId("tab-bar");
    expect(tabBar).toBeInTheDocument();
    expect(screen.queryByTestId("tab-image")).not.toBeInTheDocument();
  });

  test("initializes with bgType from props", () => {
    render(<SurveyBgSelectorTab {...defaultProps} bgType="animation" bg="animation2" />);

    const tabBar = screen.getByTestId("tab-bar");
    expect(tabBar).toHaveAttribute("data-active-tab", "animation");

    const animationComponent = screen.getByTestId("animated-survey-bg");
    expect(animationComponent).toBeInTheDocument();
    expect(animationComponent).toHaveAttribute("data-background", "animation2");
  });

  test("calls handleBgChange when color is selected", async () => {
    const user = userEvent.setup();
    render(<SurveyBgSelectorTab {...defaultProps} />);

    const colorSelectButton = screen.getByTestId("color-select-button");
    await user.click(colorSelectButton);

    expect(mockHandleBgChange).toHaveBeenCalledWith("#FF5500", "color");
  });

  test("calls handleBgChange when animation is selected", async () => {
    const user = userEvent.setup();
    render(<SurveyBgSelectorTab {...defaultProps} />);

    await user.click(screen.getByTestId("tab-animation"));
    const animationSelectButton = screen.getByTestId("animation-select-button");
    await user.click(animationSelectButton);

    expect(mockHandleBgChange).toHaveBeenCalledWith("animation1", "animation");
  });

  test("calls handleBgChange when upload image is selected", async () => {
    const user = userEvent.setup();
    render(<SurveyBgSelectorTab {...defaultProps} />);

    await user.click(screen.getByTestId("tab-upload"));
    const uploadSelectButton = screen.getByTestId("upload-select-button");
    await user.click(uploadSelectButton);

    expect(mockHandleBgChange).toHaveBeenCalledWith("image-url.jpg", "upload");
  });

  test("calls handleBgChange when unsplash image is selected", async () => {
    const user = userEvent.setup();
    render(<SurveyBgSelectorTab {...defaultProps} />);

    await user.click(screen.getByTestId("tab-image"));
    const unsplashSelectButton = screen.getByTestId("unsplash-select-button");
    await user.click(unsplashSelectButton);

    expect(mockHandleBgChange).toHaveBeenCalledWith("/image-backgrounds/dogs.webp", "image");
  });

  test("updates background states correctly when bgType is color", () => {
    render(<SurveyBgSelectorTab {...defaultProps} bgType="color" bg="#FF0000" />);

    const colorComponent = screen.getByTestId("color-survey-bg");
    expect(colorComponent).toHaveAttribute("data-background", "#FF0000");
  });

  test("updates background states correctly when bgType is animation", () => {
    render(<SurveyBgSelectorTab {...defaultProps} bgType="animation" bg="animation2" />);

    const animationComponent = screen.getByTestId("animated-survey-bg");
    expect(animationComponent).toHaveAttribute("data-background", "animation2");
  });

  test("updates background states correctly when bgType is upload", () => {
    render(<SurveyBgSelectorTab {...defaultProps} bgType="upload" bg="image-url.jpg" />);

    const uploadComponent = screen.getByTestId("upload-survey-bg");
    expect(uploadComponent).toHaveAttribute("data-background", "image-url.jpg");
  });
});
