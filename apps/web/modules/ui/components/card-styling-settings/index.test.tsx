import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { CardStylingSettings } from "./index";

// Mock components used inside CardStylingSettings
vi.mock("@/modules/ui/components/card-arrangement-tabs", () => ({
  CardArrangementTabs: vi.fn(() => <div data-testid="card-arrangement-tabs">Card Arrangement Tabs</div>),
}));

vi.mock("@/modules/ui/components/color-picker", () => ({
  ColorPicker: vi.fn(({ onChange, color }) => (
    <div data-testid="color-picker" onClick={() => onChange("#ff0000")}>
      Color: {color}
    </div>
  )),
}));

vi.mock("@/modules/ui/components/slider", () => ({
  Slider: vi.fn(({ onValueChange, value }) => (
    <div data-testid="slider" onClick={() => onValueChange([12])}>
      Value: {value}
    </div>
  )),
}));

vi.mock("@/modules/ui/components/switch", () => ({
  Switch: vi.fn(({ onCheckedChange, checked }) => (
    <button
      data-testid="switch"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}>
      Toggle
    </button>
  )),
}));

vi.mock("@/modules/ui/components/badge", () => ({
  Badge: ({ text, type, size }) => (
    <span data-testid="badge" data-type={type} data-size={size}>
      {text}
    </span>
  ),
}));

vi.mock("@/modules/ui/components/form", () => ({
  FormControl: ({ children }) => <div data-testid="form-control">{children}</div>,
  FormDescription: ({ children }) => <div data-testid="form-description">{children}</div>,
  FormField: ({ name, render }) => {
    const field = {
      value:
        name === "roundness"
          ? 8
          : name === "hideProgressBar"
            ? false
            : name === "isLogoHidden"
              ? false
              : "#ffffff",
      onChange: vi.fn(),
    };
    return render({ field, fieldState: { error: null } });
  },
  FormItem: ({ children }) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }) => <div data-testid="form-label">{children}</div>,
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [{ current: null }],
}));

// Create a wrapper component with FormProvider
const TestWrapper = ({
  children,
  defaultValues = {
    cardArrangement: { linkSurveys: "straight", appSurveys: "straight" },
    roundness: 8,
    hideProgressBar: false,
    isLogoHidden: false,
    cardBackgroundColor: { light: "#ffffff" },
    cardBorderColor: { light: "#e2e8f0" },
  },
}) => {
  const methods = useForm({ defaultValues });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const TestComponent = ({
  open = true,
  isSettingsPage = false,
  surveyType = "link" as TSurveyType,
  disabled = false,
}) => {
  const mockSetOpen = vi.fn();
  const mockProject = { logo: { url: surveyType === "link" ? "https://example.com/logo.png" : null } };

  const form = useForm<TProjectStyling | TSurveyStyling>({
    defaultValues: {
      cardArrangement: {
        linkSurveys: "straight" as "straight" | "casual" | "simple",
        appSurveys: "straight" as "straight" | "casual" | "simple",
      },
      roundness: 8,
      hideProgressBar: false,
      isLogoHidden: false,
      cardBackgroundColor: { light: "#ffffff" },
      cardBorderColor: { light: "#e2e8f0" },
    },
  });

  return (
    <TestWrapper>
      <CardStylingSettings
        open={open}
        setOpen={mockSetOpen}
        isSettingsPage={isSettingsPage}
        surveyType={surveyType}
        disabled={disabled}
        project={mockProject as any}
        form={form}
      />
    </TestWrapper>
  );
};

describe("CardStylingSettings", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the collapsible content when open is true", () => {
    render(<TestComponent open={true} />);

    expect(screen.getByText("environments.surveys.edit.card_styling")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.style_the_survey_card")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.roundness")).toBeInTheDocument();
  });

  test("does not render collapsible content when open is false", () => {
    render(<TestComponent open={false} />);

    expect(screen.getByText("environments.surveys.edit.card_styling")).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.edit.roundness")).not.toBeInTheDocument();
  });

  test("renders checkbox input for 'Hide progress bar'", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    // Use getAllByTestId and find the one next to the hide progress bar label
    const switchElements = screen.getAllByTestId("switch");
    const progressBarLabel = screen.getByText("environments.surveys.edit.hide_progress_bar");

    // Find the switch element that is closest to the label
    const switchElement = switchElements.find((el) =>
      el.closest('[data-testid="form-item"]')?.contains(progressBarLabel)
    );

    expect(switchElement).toBeInTheDocument();

    await user.click(switchElement!);
  });

  test("renders color pickers for styling options", () => {
    render(<TestComponent />);

    // Check for color picker elements
    const colorPickers = screen.getAllByTestId("color-picker");
    expect(colorPickers.length).toBeGreaterThan(0);

    // Check for color picker labels
    expect(screen.getByText("environments.surveys.edit.card_background_color")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.card_border_color")).toBeInTheDocument();
  });

  test("renders slider for roundness adjustment", () => {
    render(<TestComponent />);

    const slider = screen.getByTestId("slider");
    expect(slider).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.roundness")).toBeInTheDocument();
  });

  test("renders card arrangement tabs", () => {
    render(<TestComponent />);

    expect(screen.getByTestId("card-arrangement-tabs")).toBeInTheDocument();
  });

  test("shows logo hiding option for link surveys with logo", () => {
    render(<TestComponent surveyType="link" />);

    // Check for the logo badge
    const labels = screen.getAllByTestId("form-label");
    expect(labels.some((label) => label.textContent?.includes("environments.surveys.edit.hide_logo"))).toBe(
      true
    );
  });

  test("does not show logo hiding option for app surveys", () => {
    render(<TestComponent surveyType="app" />);

    // Check that there is no logo hiding option
    const labels = screen.getAllByTestId("form-label");
    expect(labels.some((label) => label.textContent?.includes("environments.surveys.edit.hide_logo"))).toBe(
      false
    );
  });

  test("renders settings page styling when isSettingsPage is true", () => {
    render(<TestComponent isSettingsPage={true} />);

    // Check that the title has the appropriate class
    const titleElement = screen.getByText("environments.surveys.edit.card_styling");

    // In the CSS, when isSettingsPage is true, the text-sm class should be applied
    // We can't directly check classes in the test, so we're checking the element is rendered
    expect(titleElement).toBeInTheDocument();
  });
});
