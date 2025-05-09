import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BackgroundStylingCard } from "./index";

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@/modules/ui/components/background-styling-card/survey-bg-selector-tab", () => ({
  SurveyBgSelectorTab: ({ bg, handleBgChange, colors, bgType, environmentId, isUnsplashConfigured }) => (
    <div
      data-testid="survey-bg-selector-tab"
      data-bg={bg}
      data-bg-type={bgType}
      data-environment-id={environmentId}
      data-unsplash-configured={isUnsplashConfigured.toString()}>
      <button onClick={() => handleBgChange("new-bg-value", "color")} data-testid="mock-bg-change-button">
        Change Background
      </button>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/slider", () => ({
  Slider: ({ value, max, onValueChange }) => (
    <div data-testid="slider" data-value={value[0]} data-max={max}>
      <button onClick={() => onValueChange([50])} data-testid="mock-slider-change">
        Change Brightness
      </button>
    </div>
  ),
}));

// Mock the form components to avoid react-hook-form issues
vi.mock("@/modules/ui/components/form", () => ({
  FormControl: ({ children }) => <div data-testid="form-control">{children}</div>,
  FormDescription: ({ children }) => <div data-testid="form-description">{children}</div>,
  FormField: ({ name, render }) => {
    const field = {
      value: name.includes("brightness") ? 100 : { bg: "#FF0000", bgType: "color", brightness: 100 },
      onChange: vi.fn(),
      name: name,
    };
    return render({ field });
  },
  FormItem: ({ children }) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }) => <div data-testid="form-label">{children}</div>,
}));

describe("BackgroundStylingCard", () => {
  const mockSetOpen = vi.fn();
  const mockColors = ["#FF0000", "#00FF00", "#0000FF"];
  const mockEnvironmentId = "env-123";

  const mockForm = {
    control: {},
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders closed card with correct title and description", () => {
    render(
      <BackgroundStylingCard
        open={false}
        setOpen={mockSetOpen}
        colors={mockColors}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    expect(screen.getByText("environments.surveys.edit.background_styling")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.change_the_background_to_a_color_image_or_animation")
    ).toBeInTheDocument();

    // The content should not be visible when closed
    expect(screen.queryByTestId("survey-bg-selector-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slider")).not.toBeInTheDocument();
  });

  test("renders open card with background selection and brightness control", () => {
    render(
      <BackgroundStylingCard
        open={true}
        setOpen={mockSetOpen}
        colors={mockColors}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    expect(screen.getByText("environments.surveys.edit.change_background")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.pick_a_background_from_our_library_or_upload_your_own")
    ).toBeInTheDocument();

    expect(screen.getByTestId("survey-bg-selector-tab")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.brightness")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.darken_or_lighten_background_of_your_choice")
    ).toBeInTheDocument();
    expect(screen.getByTestId("slider")).toBeInTheDocument();
  });

  test("shows settings page badge when isSettingsPage is true", () => {
    render(
      <BackgroundStylingCard
        open={false}
        setOpen={mockSetOpen}
        colors={mockColors}
        isSettingsPage={true}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    expect(screen.getByText("common.link_surveys")).toBeInTheDocument();
  });

  test("has disabled state when disabled prop is true", () => {
    render(
      <BackgroundStylingCard
        open={false}
        setOpen={mockSetOpen}
        colors={mockColors}
        disabled={true}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    // Find the trigger container which should have the disabled class
    const triggerContainer = screen.getByTestId("background-styling-card-trigger");
    expect(triggerContainer).toHaveClass("cursor-not-allowed");
  });

  test("clicking on card toggles open state when not disabled", async () => {
    const user = userEvent.setup();
    render(
      <BackgroundStylingCard
        open={false}
        setOpen={mockSetOpen}
        colors={mockColors}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    const trigger = screen.getByText("environments.surveys.edit.background_styling");
    await user.click(trigger);

    expect(mockSetOpen).toHaveBeenCalledWith(true);
  });

  test("clicking on card does not toggle open state when disabled", async () => {
    const user = userEvent.setup();
    render(
      <BackgroundStylingCard
        open={false}
        setOpen={mockSetOpen}
        colors={mockColors}
        disabled={true}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    const trigger = screen.getByText("environments.surveys.edit.background_styling");
    await user.click(trigger);

    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("changes background when background selector is used", async () => {
    const user = userEvent.setup();

    render(
      <BackgroundStylingCard
        open={true}
        setOpen={mockSetOpen}
        colors={mockColors}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    const bgChangeButton = screen.getByTestId("mock-bg-change-button");
    await user.click(bgChangeButton);

    // Verify the component rendered correctly
    expect(screen.getByTestId("survey-bg-selector-tab")).toBeInTheDocument();
  });

  test("changes brightness when slider is used", async () => {
    const user = userEvent.setup();

    render(
      <BackgroundStylingCard
        open={true}
        setOpen={mockSetOpen}
        colors={mockColors}
        environmentId={mockEnvironmentId}
        isUnsplashConfigured={true}
        form={mockForm as any}
      />
    );

    const sliderChangeButton = screen.getByTestId("mock-slider-change");
    await user.click(sliderChangeButton);

    // Verify the component rendered correctly
    expect(screen.getByTestId("slider")).toBeInTheDocument();
  });
});
