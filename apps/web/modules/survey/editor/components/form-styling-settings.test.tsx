import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, UseFormReturn, useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { FormStylingSettings } from "./form-styling-settings";

// Mock window.matchMedia - required for useAutoAnimate
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @formkit/auto-animate - simplify implementation to avoid matchMedia issues
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "test",
}));

// Mock mixColor function
vi.mock("@/lib/utils/colors", () => ({
  //@ts-ignore // Ignore TypeScript error for the mock
  mixColor: (color1: string, color2: string, weight: number) => "#123456",
}));

describe("FormStylingSettings Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render collapsible content when open is true", () => {
    // Create a form with useForm hook and provide default values
    const FormWithProvider = () => {
      const methods = useForm({
        defaultValues: {
          brandColor: { light: "#ff0000" },
          background: { bg: "#ffffff", bgType: "color" },
          highlightBorderColor: { light: "#aaaaaa" },
          questionColor: { light: "#000000" },
          inputColor: { light: "#ffffff" },
          inputBorderColor: { light: "#cccccc" },
          cardBackgroundColor: { light: "#ffffff" },
          cardBorderColor: { light: "#eeeeee" },
        },
      }) as UseFormReturn<TProjectStyling | TSurveyStyling>;

      const defaultProps = {
        open: true,
        setOpen: vi.fn(),
        isSettingsPage: false,
        disabled: false,
        form: methods,
      };

      return (
        <FormProvider {...methods}>
          <FormStylingSettings {...defaultProps} />
        </FormProvider>
      );
    };

    render(<FormWithProvider />);

    // Check that the component renders the header
    expect(screen.getByText("environments.surveys.edit.form_styling")).toBeInTheDocument();

    // Check for elements that should only be visible when the collapsible is open
    expect(screen.getByText("environments.surveys.edit.brand_color")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.question_color")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.input_color")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.input_border_color")).toBeInTheDocument();

    // Check for the suggest colors button which should be visible when open
    expect(screen.getByText("environments.surveys.edit.suggest_colors")).toBeInTheDocument();
  });

  test("should disable collapsible trigger when disabled is true", async () => {
    const user = userEvent.setup();
    const setOpenMock = vi.fn();

    // Create a form with useForm hook and provide default values
    const FormWithProvider = () => {
      const methods = useForm({
        defaultValues: {
          brandColor: { light: "#ff0000" },
          background: { bg: "#ffffff", bgType: "color" },
          highlightBorderColor: { light: "#aaaaaa" },
          questionColor: { light: "#000000" },
          inputColor: { light: "#ffffff" },
          inputBorderColor: { light: "#cccccc" },
          cardBackgroundColor: { light: "#ffffff" },
          cardBorderColor: { light: "#eeeeee" },
        },
      }) as UseFormReturn<TProjectStyling | TSurveyStyling>;

      const props = {
        open: false,
        setOpen: setOpenMock,
        isSettingsPage: false,
        disabled: true, // Set disabled to true for this test
        form: methods,
      };

      return (
        <FormProvider {...methods}>
          <FormStylingSettings {...props} />
        </FormProvider>
      );
    };

    const { container } = render(<FormWithProvider />);

    // Find the collapsible trigger element
    const triggerElement = container.querySelector('[class*="cursor-not-allowed opacity-60"]');
    expect(triggerElement).toBeInTheDocument();

    // Verify that the trigger has the disabled attribute
    const collapsibleTrigger = container.querySelector('[disabled=""]');
    expect(collapsibleTrigger).toBeInTheDocument();

    // Check that the correct CSS classes are applied for the disabled state
    expect(triggerElement).toHaveClass("cursor-not-allowed");
    expect(triggerElement).toHaveClass("opacity-60");
    expect(triggerElement).toHaveClass("hover:bg-white");

    // Try to click the trigger and verify that setOpen is not called
    if (triggerElement) {
      await user.click(triggerElement);
      expect(setOpenMock).not.toHaveBeenCalled();
    }

    // Verify the component still renders the main content
    expect(screen.getByText("environments.surveys.edit.form_styling")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.style_the_question_texts_descriptions_and_input_fields")
    ).toBeInTheDocument();
  });

  test("should call setOpen with updated state when collapsible trigger is clicked", async () => {
    const user = userEvent.setup();
    const setOpenMock = vi.fn();

    // Create a form with useForm hook and provide default values
    const FormWithProvider = () => {
      const methods = useForm({
        defaultValues: {
          brandColor: { light: "#ff0000" },
          background: { bg: "#ffffff", bgType: "color" },
          highlightBorderColor: { light: "#aaaaaa" },
          questionColor: { light: "#000000" },
          inputColor: { light: "#ffffff" },
          inputBorderColor: { light: "#cccccc" },
          cardBackgroundColor: { light: "#ffffff" },
          cardBorderColor: { light: "#eeeeee" },
        },
      }) as UseFormReturn<TProjectStyling | TSurveyStyling>;

      const props = {
        open: false, // Start with closed state
        setOpen: setOpenMock,
        isSettingsPage: false,
        disabled: false,
        form: methods,
      };

      return (
        <FormProvider {...methods}>
          <FormStylingSettings {...props} />
        </FormProvider>
      );
    };

    render(<FormWithProvider />);

    // Find the collapsible trigger element
    const triggerElement = screen.getByText("environments.surveys.edit.form_styling").closest("div");
    expect(triggerElement).toBeInTheDocument();

    // Click the trigger element
    await user.click(triggerElement!);

    // Verify that setOpen was called with true (to open the collapsible)
    expect(setOpenMock).toHaveBeenCalledWith(true);

    // Test closing the collapsible
    // First, we need to re-render with open=true
    cleanup();

    const FormWithProviderOpen = () => {
      const methods = useForm({
        defaultValues: {
          brandColor: { light: "#ff0000" },
          background: { bg: "#ffffff", bgType: "color" },
          highlightBorderColor: { light: "#aaaaaa" },
          questionColor: { light: "#000000" },
          inputColor: { light: "#ffffff" },
          inputBorderColor: { light: "#cccccc" },
          cardBackgroundColor: { light: "#ffffff" },
          cardBorderColor: { light: "#eeeeee" },
        },
      }) as UseFormReturn<TProjectStyling | TSurveyStyling>;

      const props = {
        open: true, // Start with open state
        setOpen: setOpenMock,
        isSettingsPage: false,
        disabled: false,
        form: methods,
      };

      return (
        <FormProvider {...methods}>
          <FormStylingSettings {...props} />
        </FormProvider>
      );
    };

    render(<FormWithProviderOpen />);

    // Reset mock to clear previous calls
    setOpenMock.mockReset();

    // Find and click the trigger element again
    const openTriggerElement = screen.getByText("environments.surveys.edit.form_styling").closest("div");
    await user.click(openTriggerElement!);

    // Verify that setOpen was called with false (to close the collapsible)
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });

  test("should render correct text and descriptions using useTranslate", () => {
    // Create a form with useForm hook and provide default values
    const FormWithProvider = () => {
      // NOSONAR // No need to check this mock
      const methods = useForm({
        defaultValues: {
          brandColor: { light: "#ff0000" },
          background: { bg: "#ffffff", bgType: "color" },
          highlightBorderColor: { light: "#aaaaaa" },
          questionColor: { light: "#000000" },
          inputColor: { light: "#ffffff" },
          inputBorderColor: { light: "#cccccc" },
          cardBackgroundColor: { light: "#ffffff" },
          cardBorderColor: { light: "#eeeeee" },
        },
      }) as UseFormReturn<TProjectStyling | TSurveyStyling>;

      const defaultProps = {
        open: true,
        setOpen: vi.fn(),
        isSettingsPage: false,
        disabled: false,
        form: methods,
      };

      return (
        <FormProvider {...methods}>
          <FormStylingSettings {...defaultProps} />
        </FormProvider>
      );
    };

    render(<FormWithProvider />);

    // Check that the component renders the header text correctly
    expect(screen.getByText("environments.surveys.edit.form_styling")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.style_the_question_texts_descriptions_and_input_fields")
    ).toBeInTheDocument();

    // Check for form field labels and descriptions
    expect(screen.getByText("environments.surveys.edit.brand_color")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.change_the_brand_color_of_the_survey")
    ).toBeInTheDocument();

    expect(screen.getByText("environments.surveys.edit.question_color")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.change_the_question_color_of_the_survey")
    ).toBeInTheDocument();

    expect(screen.getByText("environments.surveys.edit.input_color")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.change_the_background_color_of_the_input_fields")
    ).toBeInTheDocument();

    expect(screen.getByText("environments.surveys.edit.input_border_color")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.change_the_border_color_of_the_input_fields")
    ).toBeInTheDocument();

    // Check for the suggest colors button text
    expect(screen.getByText("environments.surveys.edit.suggest_colors")).toBeInTheDocument();
  });

  test("should render different text based on isSettingsPage prop", () => {
    // Create a form with useForm hook and provide default values
    const FormWithProvider = ({ isSettingsPage = true }) => {
      const methods = useForm({
        defaultValues: {
          brandColor: { light: "#ff0000" },
          background: { bg: "#ffffff", bgType: "color" },
          highlightBorderColor: { light: "#aaaaaa" },
        },
      }) as UseFormReturn<TProjectStyling | TSurveyStyling>;

      const props = {
        open: true,
        setOpen: vi.fn(),
        isSettingsPage,
        disabled: false,
        form: methods,
      };

      return (
        <FormProvider {...methods}>
          <FormStylingSettings {...props} />
        </FormProvider>
      );
    };

    render(<FormWithProvider isSettingsPage={true} />);

    // Check that the text has the correct CSS classes when isSettingsPage is true
    const headerTextWithSettingsPage = screen.getByText("environments.surveys.edit.form_styling");
    expect(headerTextWithSettingsPage).toHaveClass("text-sm");

    const descriptionTextWithSettingsPage = screen.getByText(
      "environments.surveys.edit.style_the_question_texts_descriptions_and_input_fields"
    );
    expect(descriptionTextWithSettingsPage).toHaveClass("text-xs");

    // Re-render with isSettingsPage as false
    cleanup();
    render(<FormWithProvider isSettingsPage={false} />);

    // Check that the text has the correct CSS classes when isSettingsPage is false
    const headerTextWithoutSettingsPage = screen.getByText("environments.surveys.edit.form_styling");
    expect(headerTextWithoutSettingsPage).toHaveClass("text-base");

    const descriptionTextWithoutSettingsPage = screen.getByText(
      "environments.surveys.edit.style_the_question_texts_descriptions_and_input_fields"
    );
    expect(descriptionTextWithoutSettingsPage).toHaveClass("text-sm");

    // Verify the CheckIcon is shown only when isSettingsPage is false
    const checkIcon = document.querySelector(".h-7.w-7.rounded-full.border.border-green-300");
    expect(checkIcon).toBeInTheDocument();
  });

  test("should maintain open state but prevent toggling when disabled while open", async () => {
    const user = userEvent.setup();
    const setOpenMock = vi.fn();

    // Create a component wrapper that allows us to change props
    const TestComponent = ({ disabled = false }) => {
      const methods = useForm({
        defaultValues: {
          brandColor: { light: "#ff0000" },
          background: { bg: "#ffffff", bgType: "color" },
          highlightBorderColor: { light: "#aaaaaa" },
          questionColor: { light: "#000000" },
          inputColor: { light: "#ffffff" },
          inputBorderColor: { light: "#cccccc" },
          cardBackgroundColor: { light: "#ffffff" },
          cardBorderColor: { light: "#eeeeee" },
        },
      }) as UseFormReturn<TProjectStyling | TSurveyStyling>;

      return (
        <FormProvider {...methods}>
          <FormStylingSettings open={true} setOpen={setOpenMock} disabled={disabled} form={methods} />
        </FormProvider>
      );
    };

    // First render with enabled state
    const { rerender } = render(<TestComponent disabled={false} />);

    // Verify component is open by checking for content that should be visible when open
    expect(screen.getByText("environments.surveys.edit.brand_color")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.suggest_colors")).toBeInTheDocument();

    // Re-render with disabled state (simulating component becoming disabled while open)
    rerender(<TestComponent disabled={true} />);

    // Get the collapsible trigger element
    const triggerElement = screen.getByText("environments.surveys.edit.form_styling").closest("div");
    expect(triggerElement).toBeInTheDocument();

    // Attempt to click the trigger to close the collapsible
    if (triggerElement) {
      await user.click(triggerElement);
    }

    // Verify the component is still open
    expect(screen.getByText("environments.surveys.edit.brand_color")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.suggest_colors")).toBeInTheDocument();

    // Verify setOpen was not called, confirming the toggle was prevented
    expect(setOpenMock).not.toHaveBeenCalled();
  });
});
