import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { EndingCardSelector } from "./ending-card-selector";

// Mock Radix UI Select components
vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.("test-value")}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectGroup: ({ children }: any) => <div data-testid="select-group">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

// Mock localization utils
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (value: any, locale: string) => {
    if (typeof value === "object" && value !== null) {
      return value[locale] || value.default || "Test Headline";
    }
    return value || "Test Headline";
  },
}));

describe("EndingCardSelector", () => {
  const mockOnChange = vi.fn();

  const mockSurveyWithEndings: TSurvey = {
    id: "survey1",
    endings: [
      {
        id: "ending1",
        type: "endScreen",
        headline: { default: "Thank you!" },
        subheader: { default: "Survey complete" },
      },
      {
        id: "ending2",
        type: "endScreen",
        headline: { default: "Survey Complete" },
        subheader: { default: "Thanks for participating" },
      },
      {
        id: "redirect1",
        type: "redirectToUrl",
        url: "https://example.com",
      },
      {
        id: "redirect2",
        type: "redirectToUrl",
        url: "https://test.com",
      },
    ],
  } as TSurvey;

  const mockSurveyEmpty: TSurvey = {
    id: "survey2",
    endings: [],
  } as unknown as TSurvey;

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders select component", () => {
    render(<EndingCardSelector endings={mockSurveyWithEndings.endings} value="" onChange={mockOnChange} />);

    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(screen.getByTestId("select-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("select-value")).toBeInTheDocument();
  });

  test("shows placeholder when no value selected", () => {
    render(<EndingCardSelector endings={mockSurveyWithEndings.endings} value="" onChange={mockOnChange} />);

    expect(screen.getByText("environments.surveys.edit.quotas.select_ending_card")).toBeInTheDocument();
  });

  test("displays ending card options", () => {
    render(<EndingCardSelector endings={mockSurveyWithEndings.endings} value="" onChange={mockOnChange} />);

    // Should show ending card section
    expect(screen.getByText("common.ending_card")).toBeInTheDocument();

    // Should show ending card items
    const endingItems = screen.getAllByTestId("select-item");
    const endingCardItems = endingItems.filter(
      (item) => item.getAttribute("data-value") === "ending1" || item.getAttribute("data-value") === "ending2"
    );
    expect(endingCardItems).toHaveLength(2);
  });

  test("displays redirect URL options", () => {
    render(<EndingCardSelector endings={mockSurveyWithEndings.endings} value="" onChange={mockOnChange} />);

    // Should show redirect URL section
    expect(screen.getByText("environments.surveys.edit.redirect_to_url")).toBeInTheDocument();

    // Should show redirect items with generic labels
    expect(screen.getByText("environments.surveys.edit.redirect_to_url")).toBeInTheDocument();
  });

  test("calls onChange when selection is made", async () => {
    const user = userEvent.setup();

    render(<EndingCardSelector endings={mockSurveyWithEndings.endings} value="" onChange={mockOnChange} />);

    const select = screen.getByTestId("select");
    await user.click(select);

    expect(mockOnChange).toHaveBeenCalledWith("test-value");
  });

  test("handles survey with no endings", () => {
    render(<EndingCardSelector endings={mockSurveyEmpty.endings} value="" onChange={mockOnChange} />);

    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(screen.queryByText("common.ending_card")).not.toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.edit.redirect_to_url")).not.toBeInTheDocument();
  });

  test("filters endings correctly by type", () => {
    render(<EndingCardSelector endings={mockSurveyWithEndings.endings} value="" onChange={mockOnChange} />);

    // Should only show endScreen endings in ending card section
    const endingCardSection = screen.getByText("common.ending_card").closest("[data-testid='select-group']");
    expect(endingCardSection).toBeInTheDocument();

    // Should only show redirectToUrl endings in redirect section
    const redirectSection = screen
      .getByText("environments.surveys.edit.redirect_to_url")
      .closest("[data-testid='select-group']");
    expect(redirectSection).toBeInTheDocument();
  });

  test("shows correct value when selected", () => {
    render(
      <EndingCardSelector endings={mockSurveyWithEndings.endings} value="ending1" onChange={mockOnChange} />
    );

    const select = screen.getByTestId("select");
    expect(select).toHaveAttribute("data-value", "ending1");
  });

  test("handles ending without headline gracefully", () => {
    const surveyWithEndingNoHeadline: TSurvey = {
      id: "survey4",
      endings: [
        {
          id: "ending3",
          type: "endScreen",
          subheader: { default: "Just subheader" },
        },
      ],
    } as unknown as TSurvey;

    render(
      <EndingCardSelector endings={surveyWithEndingNoHeadline.endings} value="" onChange={mockOnChange} />
    );

    // Should still render the component without errors
    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(screen.getByText("common.ending_card")).toBeInTheDocument();
  });
});
