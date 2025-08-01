import { AutoCloseProgressBar } from "@/components/general/auto-close-progress-bar";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AutoCloseWrapper } from "./auto-close-wrapper";

// Mock the AutoCloseProgressBar component
vi.mock("@/components/general/auto-close-progress-bar", () => ({
  AutoCloseProgressBar: vi.fn(() => <div data-testid="auto-close-progress-bar" />),
}));

describe("AutoCloseWrapper", () => {
  const mockSurvey = {
    id: "survey-123",
    type: "app",
    autoClose: 5,
    welcomeCard: {
      enabled: true,
    },
  } as any;

  const mockOnClose = vi.fn();
  const mockSetHasInteracted = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnClose.mockClear();
    mockSetHasInteracted.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("renders children correctly", () => {
    const { getByTestId } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div data-testid="child-content">Child Content</div>
      </AutoCloseWrapper>
    );

    expect(getByTestId("child-content")).toBeTruthy();
    expect(getByTestId("child-content").textContent).toBe("Child Content");
  });

  test("shows progress bar for first question in app survey when not interacted", () => {
    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    expect(queryByTestId("auto-close-progress-bar")).toBeTruthy();
    expect(AutoCloseProgressBar).toHaveBeenCalledWith({ autoCloseTimeout: 5 }, expect.anything());
  });

  test("doesn't show progress bar when hasInteracted is true", () => {
    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={true}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    expect(queryByTestId("auto-close-progress-bar")).toBeFalsy();
  });

  test("doesn't show progress bar for non-welcome card when welcomeCard is enabled", () => {
    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={0}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    expect(queryByTestId("auto-close-progress-bar")).toBeFalsy();
  });

  test("doesn't show progress bar for non-first question when welcomeCard is disabled", () => {
    const surveyWithoutWelcomeCard = {
      ...mockSurvey,
      welcomeCard: { enabled: false },
    };

    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={surveyWithoutWelcomeCard}
        questionIdx={1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    expect(queryByTestId("auto-close-progress-bar")).toBeFalsy();
  });

  test("shows progress bar for first question (index 0) when welcomeCard is disabled", () => {
    const surveyWithoutWelcomeCard = {
      ...mockSurvey,
      welcomeCard: { enabled: false },
    };

    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={surveyWithoutWelcomeCard}
        questionIdx={0}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    expect(queryByTestId("auto-close-progress-bar")).toBeTruthy();
  });

  test("doesn't show progress bar when survey is not an app survey", () => {
    const linkSurvey = {
      ...mockSurvey,
      type: "link",
    };

    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={linkSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    expect(queryByTestId("auto-close-progress-bar")).toBeFalsy();
  });

  test("calls onClose after autoClose timeout", () => {
    render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    // Advance timer by the autoClose duration (5 seconds)
    vi.advanceTimersByTime(5000);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("doesn't start countdown if autoClose is not set", () => {
    const surveyWithoutAutoClose = {
      ...mockSurvey,
      autoClose: undefined,
    };

    render(
      <AutoCloseWrapper
        survey={surveyWithoutAutoClose}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    vi.advanceTimersByTime(10000);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test("doesn't start countdown if not on first question", () => {
    render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={1} // Not the first question
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    vi.advanceTimersByTime(10000);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test("doesn't start countdown if user has already interacted", () => {
    render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={true} // Already interacted
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    vi.advanceTimersByTime(10000);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test("stops countdown on interaction (click)", () => {
    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div data-testid="child-content">Child Content</div>
      </AutoCloseWrapper>
    );

    // Find the wrapper div that has the click handler (the inner one with event handlers)
    const wrapper = queryByTestId("fb__surveys__auto-close-wrapper-test");
    expect(wrapper).toBeTruthy();

    // Use fireEvent instead of userEvent for more reliable event triggering
    fireEvent.click(wrapper!);

    expect(mockSetHasInteracted).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(10000);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test("stops countdown on interaction (mouseover)", () => {
    const { queryByTestId } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div data-testid="child-content">Child Content</div>
      </AutoCloseWrapper>
    );

    // Find the wrapper div that has the mouseover handler (the inner one with event handlers)
    const wrapper = queryByTestId("fb__surveys__auto-close-wrapper-test");
    expect(wrapper).toBeTruthy();

    // Use fireEvent instead of userEvent for more reliable event triggering
    fireEvent.mouseOver(wrapper!);

    expect(mockSetHasInteracted).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(10000);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test("re-runs startCountdown when survey.autoClose changes", () => {
    const { rerender } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    const updatedSurvey = {
      ...mockSurvey,
      autoClose: 10, // Changed from 5 to 10
    };

    rerender(
      <AutoCloseWrapper
        survey={updatedSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    // Advance timer by the original autoClose duration (5 seconds)
    vi.advanceTimersByTime(5000);
    expect(mockOnClose).not.toHaveBeenCalled();

    // Advance timer by the remaining time for the new autoClose (10 seconds)
    vi.advanceTimersByTime(5000);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("cleans up timeout on unmount", () => {
    const { unmount } = render(
      <AutoCloseWrapper
        survey={mockSurvey}
        questionIdx={-1}
        onClose={mockOnClose}
        hasInteracted={false}
        setHasInteracted={mockSetHasInteracted}>
        <div>Child Content</div>
      </AutoCloseWrapper>
    );

    unmount();

    vi.advanceTimersByTime(10000);
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockSetHasInteracted).toHaveBeenCalledWith(true);
  });
});
