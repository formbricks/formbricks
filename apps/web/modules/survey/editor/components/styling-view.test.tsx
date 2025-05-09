import { defaultStyling } from "@/lib/styling/constants";
import { Project } from "@prisma/client";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
// Import actual components
import { StylingView } from "./styling-view";

// Mock react-hot-toast so we can assert that a success message is shown
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a data-testid="mock-link" href={href}>
      {children}
    </a>
  ),
}));

// Mocks for child components remain the same
vi.mock("@/modules/survey/editor/components/form-styling-settings", () => ({
  FormStylingSettings: ({ open, setOpen, disabled }: any) => (
    <div data-testid="form-styling-settings" data-open={open} data-disabled={disabled}>
      <span>Form Styling Settings</span>
      <button onClick={() => setOpen(!open)}>Toggle Form Styling</button>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/alert-dialog", () => ({
  AlertDialog: ({ open, setOpen, onConfirm }: any) =>
    open ? (
      <div data-testid="alert-dialog">
        <span>Alert Dialog</span>
        <button data-testid="confirm-reset" onClick={onConfirm}>
          common.confirm
        </button>
        <button onClick={() => setOpen(false)}>Close Alert</button>
      </div>
    ) : null,
}));

vi.mock("@/modules/ui/components/background-styling-card", () => ({
  BackgroundStylingCard: ({ open, setOpen, disabled }: any) => (
    <div data-testid="background-styling-card" data-open={open} data-disabled={disabled}>
      <span>Background Styling Card</span>
      <button onClick={() => setOpen(!open)}>Toggle Background Styling</button>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, type = "button" }: any) => (
    <button data-testid={`button-${variant}`} onClick={onClick} type={type}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/card-styling-settings", () => ({
  CardStylingSettings: ({ open, setOpen, disabled }: any) => (
    <div data-testid="card-styling-settings" data-open={open} data-disabled={disabled}>
      <span>Card Styling Settings</span>
      <button onClick={() => setOpen(!open)}>Toggle Card Styling</button>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      data-testid="overwrite-switch"
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

// Global state for mocks (keep prop mocks)
const mockSetStyling = vi.fn();
const mockSetLocalStylingChanges = vi.fn();
const mockSetLocalSurvey = vi.fn();

const mockProject = {
  id: "projectId",
  name: "Test Project",
  styling: { ...defaultStyling, allowStyleOverwrite: true },
} as unknown as Project;

// Adjust mockSurvey styling based on test needs or pass via props
const mockSurvey = {
  id: "surveyId",
  name: "Test Survey",
  type: "link",
  styling: { overwriteThemeStyling: false } as unknown as TSurveyStyling, // Initial state for most tests
} as unknown as TSurvey;

const mockAppSurvey = {
  ...mockSurvey,
  type: "app",
} as unknown as TSurvey;

const defaultProps = {
  environmentId: "envId",
  project: mockProject,
  localSurvey: mockSurvey,
  setLocalSurvey: mockSetLocalSurvey,
  colors: ["#ffffff", "#000000"],
  styling: null, // Will be set by the component logic based on overwrite toggle
  setStyling: mockSetStyling,
  localStylingChanges: null, // Will be set by the component logic
  setLocalStylingChanges: mockSetLocalStylingChanges,
  isUnsplashConfigured: true,
  isCxMode: false,
};

// Helper component to provide REAL Form context
const RenderWithFormProvider = ({
  children,
  localSurveyOverrides = {},
}: {
  children: React.ReactNode;
  localSurveyOverrides?: Partial<TSurveyStyling>; // Accept styling overrides
}) => {
  // Determine initial form values based on project and potential survey overrides
  const initialStyling = {
    ...defaultStyling,
    ...mockProject.styling,
    ...localSurveyOverrides, // Apply overrides passed to the helper
  };

  const methods = useForm<TSurveyStyling>({
    defaultValues: initialStyling,
  });

  // Pass the real methods down
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe("StylingView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders correctly with default props (overwrite off)", () => {
    render(
      // Pass initial survey styling state via overrides
      <RenderWithFormProvider localSurveyOverrides={mockSurvey.styling ?? {}}>
        <StylingView {...defaultProps} localSurvey={mockSurvey} />
      </RenderWithFormProvider>
    );
    expect(screen.getByText("environments.surveys.edit.add_custom_styles")).toBeInTheDocument();
    expect(screen.getByTestId("form-styling-settings")).toBeInTheDocument();
    expect(screen.getByTestId("card-styling-settings")).toBeInTheDocument();
    expect(screen.getByTestId("background-styling-card")).toBeInTheDocument();
    expect(screen.getByTestId("overwrite-switch")).not.toBeChecked();
    // Check disabled state based on overwriteThemeStyling being false
    expect(screen.getByTestId("form-styling-settings")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("card-styling-settings")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("background-styling-card")).toHaveAttribute("data-disabled", "true");
    expect(screen.queryByTestId("button-ghost")).not.toBeInTheDocument();
  });

  test("toggles overwrite theme styling switch", async () => {
    const user = userEvent.setup();
    // Start with overwrite OFF
    const surveyWithOverwriteOff = { ...mockSurvey, styling: { overwriteThemeStyling: false } };
    const propsWithOverwriteOff = { ...defaultProps, localSurvey: surveyWithOverwriteOff, styling: null }; // styling starts null

    render(
      <RenderWithFormProvider localSurveyOverrides={surveyWithOverwriteOff.styling ?? {}}>
        <StylingView {...propsWithOverwriteOff} />
      </RenderWithFormProvider>
    );

    const switchControl = screen.getByTestId("overwrite-switch");
    expect(switchControl).not.toBeChecked();
    expect(screen.getByTestId("form-styling-settings")).toHaveAttribute("data-disabled", "true");

    // Click to turn ON
    await user.click(switchControl);

    // Wait for state update and rerender (component internal state + prop calls)
    await waitFor(() => {
      expect(switchControl).toBeChecked();
      expect(screen.getByTestId("form-styling-settings")).toHaveAttribute("data-disabled", "false");
      expect(screen.getByTestId("card-styling-settings")).toHaveAttribute("data-disabled", "false");
      expect(screen.getByTestId("background-styling-card")).toHaveAttribute("data-disabled", "false");
      expect(screen.getByTestId("button-ghost")).toBeInTheDocument(); // Reset button appears
      expect(screen.getByText("environments.surveys.edit.reset_to_theme_styles")).toBeInTheDocument();
      // Check if setStyling was called correctly when turning ON
      const { allowStyleOverwrite, ...baseStyling } = mockProject.styling;
      expect(mockSetStyling).toHaveBeenCalledWith({
        ...baseStyling,
        overwriteThemeStyling: true,
      });
    });

    vi.clearAllMocks(); // Clear mocks before next interaction

    // Click to turn OFF
    await user.click(switchControl);

    await waitFor(() => {
      expect(switchControl).not.toBeChecked();
      expect(screen.getByTestId("form-styling-settings")).toHaveAttribute("data-disabled", "true");
      expect(screen.getByTestId("card-styling-settings")).toHaveAttribute("data-disabled", "true");
      expect(screen.getByTestId("background-styling-card")).toHaveAttribute("data-disabled", "true");
      expect(screen.queryByTestId("button-ghost")).not.toBeInTheDocument(); // Reset button disappears
      // Check if setStyling was called correctly when turning OFF
      const { allowStyleOverwrite, ...baseStyling } = mockProject.styling;
      expect(mockSetStyling).toHaveBeenCalledWith({
        ...baseStyling,
        overwriteThemeStyling: false,
      });
      // Check if setLocalStylingChanges was called (it stores the state before turning off)
      expect(mockSetLocalStylingChanges).toHaveBeenCalled();
    });
  });

  test("handles reset theme styling", async () => {
    const user = userEvent.setup();
    // Start with overwrite ON and some potentially different styling
    const initialSurveyStyling = {
      ...defaultStyling,
      brandColor: { light: "#ff0000" }, // Custom color
      overwriteThemeStyling: true,
    };
    const surveyWithOverwriteOn = { ...mockSurvey, styling: initialSurveyStyling };
    const propsWithOverwriteOn = {
      ...defaultProps,
      localSurvey: surveyWithOverwriteOn,
      styling: initialSurveyStyling,
    };

    render(
      // Provide initial form values reflecting the overwrite state
      <RenderWithFormProvider localSurveyOverrides={surveyWithOverwriteOn.styling ?? {}}>
        <StylingView {...propsWithOverwriteOn} />
      </RenderWithFormProvider>
    );

    const resetButton = screen.getByTestId("button-ghost");
    expect(resetButton).toBeInTheDocument();
    await user.click(resetButton);

    await waitFor(() => expect(screen.getByTestId("alert-dialog")).toBeInTheDocument());

    const confirmButton = screen.getByTestId("confirm-reset");
    await user.click(confirmButton);

    await waitFor(() => {
      // Check that setStyling was called with the project's base styling + overwrite: true
      const { allowStyleOverwrite, ...baseStyling } = mockProject.styling;
      expect(mockSetStyling).toHaveBeenCalledWith({
        ...baseStyling,
        overwriteThemeStyling: true,
      });
      // Ensure the assertion targets the correct mocked function (provided by global mock)
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
      expect(screen.queryByTestId("alert-dialog")).not.toBeInTheDocument();
    });
  });

  test("does not render BackgroundStylingCard for app surveys", () => {
    const propsApp = { ...defaultProps, localSurvey: mockAppSurvey };
    render(
      <RenderWithFormProvider localSurveyOverrides={mockAppSurvey.styling ?? {}}>
        <StylingView {...propsApp} />
      </RenderWithFormProvider>
    );
    expect(screen.getByTestId("form-styling-settings")).toBeInTheDocument();
    expect(screen.getByTestId("card-styling-settings")).toBeInTheDocument();
    expect(screen.queryByTestId("background-styling-card")).not.toBeInTheDocument();
  });

  test("opens and closes styling sections (when overwrite is on)", async () => {
    const user = userEvent.setup();
    // Start with overwrite ON
    const surveyWithOverwriteOn = { ...mockSurvey, styling: { overwriteThemeStyling: true } };
    const propsWithOverwriteOn = {
      ...defaultProps,
      localSurvey: surveyWithOverwriteOn,
      styling: surveyWithOverwriteOn.styling,
    };

    render(
      <RenderWithFormProvider localSurveyOverrides={surveyWithOverwriteOn.styling ?? {}}>
        <StylingView {...propsWithOverwriteOn} />
      </RenderWithFormProvider>
    );

    const formStylingToggle = screen.getByText("Toggle Form Styling");
    const cardStylingToggle = screen.getByText("Toggle Card Styling");
    const backgroundStylingToggle = screen.getByText("Toggle Background Styling");

    // Check initial state (mock components default to open=false)
    expect(screen.getByTestId("form-styling-settings")).toHaveAttribute("data-open", "false");
    expect(screen.getByTestId("card-styling-settings")).toHaveAttribute("data-open", "false");
    expect(screen.getByTestId("background-styling-card")).toHaveAttribute("data-open", "false");

    // Check sections are enabled because overwrite is ON
    expect(screen.getByTestId("form-styling-settings")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("card-styling-settings")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("background-styling-card")).toHaveAttribute("data-disabled", "false");

    await user.click(formStylingToggle);
    expect(screen.getByTestId("form-styling-settings")).toHaveAttribute("data-open", "true");

    await user.click(cardStylingToggle);
    expect(screen.getByTestId("card-styling-settings")).toHaveAttribute("data-open", "true");

    await user.click(backgroundStylingToggle);
    expect(screen.getByTestId("background-styling-card")).toHaveAttribute("data-open", "true");
  });
});
