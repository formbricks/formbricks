import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TSurveyCalQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { CalEmbed } from "./cal-embed";

interface CalInlineMock extends ReturnType<typeof vi.fn> {
  bookingCallback?: () => void;
}

const mockFn = vi.fn() as CalInlineMock;

vi.mock("@calcom/embed-snippet", () => {
  return {
    default: () => mockFn,
  };
});

beforeEach(() => {
  mockFn.mockReset();
  mockFn.mockImplementation((action: string, ...args: any[]) => {
    if (action === "on") {
      // Store the callback for later use
      const [{ action: eventAction, callback }] = args;
      if (eventAction === "bookingSuccessful") {
        mockFn.bookingCallback = callback;
      }
    }
    return mockFn;
  });
});

describe("CalEmbed", () => {
  const mockQuestion: TSurveyCalQuestion = {
    id: "test-id",
    type: TSurveyQuestionTypeEnum.Cal,
    headline: { default: "Schedule a meeting" },
    required: true,
    calUserName: "test-user",
    calHost: "cal.com",
    logic: [],
  };

  const mockOnSuccessfulBooking = vi.fn();

  beforeEach(() => {
    // Create a mock element for cal-inline
    const mockCalInline = document.createElement("cal-inline");
    document.body.appendChild(mockCalInline);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders with correct container and embed div", () => {
    const { container } = render(
      <CalEmbed question={mockQuestion} onSuccessfulBooking={mockOnSuccessfulBooking} />
    );

    const embedContainer = container.querySelector(".fb-relative.fb-mt-4.fb-overflow-auto");
    expect(embedContainer).toBeInTheDocument();

    const calEmbed = container.querySelector("#fb-cal-embed");
    expect(calEmbed).toBeInTheDocument();
    expect(calEmbed).toHaveClass("fb-border-border", "fb-rounded-lg", "fb-border");
  });

  test("removes existing cal-inline elements on mount", () => {
    render(<CalEmbed question={mockQuestion} onSuccessfulBooking={mockOnSuccessfulBooking} />);

    // Check if the cal-inline elements were removed
    const calInlineElements = document.querySelectorAll("cal-inline");
    expect(calInlineElements.length).toBe(0);
  });

  test("initializes Cal.com embed with correct parameters", () => {
    const { rerender } = render(
      <CalEmbed question={mockQuestion} onSuccessfulBooking={mockOnSuccessfulBooking} />
    );

    expect(mockFn).toHaveBeenCalledWith("init", {
      calOrigin: "https://cal.com",
    });

    expect(mockFn).toHaveBeenCalledWith("inline", {
      elementOrSelector: "#fb-cal-embed",
      calLink: "test-user",
    });

    // Test with different host
    const newQuestion: TSurveyCalQuestion = { ...mockQuestion, calHost: "custom.cal.com" };
    rerender(<CalEmbed question={newQuestion} onSuccessfulBooking={mockOnSuccessfulBooking} />);

    expect(mockFn).toHaveBeenCalledWith("init", {
      calOrigin: "https://custom.cal.com",
    });
  });

  test("sets up booking success callback", () => {
    render(<CalEmbed question={mockQuestion} onSuccessfulBooking={mockOnSuccessfulBooking} />);

    expect(mockFn).toHaveBeenCalledWith("on", {
      action: "bookingSuccessful",
      callback: expect.any(Function),
    });

    // Execute the stored callback
    mockFn.bookingCallback?.();
    expect(mockOnSuccessfulBooking).toHaveBeenCalled();
  });
});
