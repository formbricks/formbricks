import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/preact";
import { MutableRef } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { StackedCard } from "./stacked-card";

// Mock the getCardContent function
const mockGetCardContent = vi.fn();

const mockSurvey: TJsEnvironmentStateSurvey = {
  id: "survey-1",
  name: "Test Survey",
  type: "app",
  status: "inProgress",
  questions: [],
  variables: [],
  welcomeCard: {
    enabled: false,
    headline: { default: "Welcome!" },
    timeToFinish: false,
    showResponseCount: false,
  },
  endings: [],
  hiddenFields: { enabled: false },
  languages: [],
  triggers: [],
  displayOption: "displayOnce",
  displayPercentage: null,
  autoClose: null,
  delay: 0,
  projectOverwrites: null,
  isBackButtonHidden: false,
  recaptcha: null,
  styling: {}, // Added styling as it's part of TJsEnvironmentStateSurvey via ZSurvey -> ZSurveyStyling.nullable()
  recontactDays: null,
  displayLimit: null,
  segment: null,
  showLanguageSwitch: false,
};

const mockCardRefs: MutableRef<(HTMLDivElement | null)[]> = { current: [] };

const defaultProps = {
  cardRefs: mockCardRefs,
  dynamicQuestionIndex: 0,
  offset: 0,
  fullSizeCards: false,
  borderStyles: { border: "1px solid black" },
  getCardContent: mockGetCardContent,
  cardHeight: "300px",
  survey: mockSurvey,
  cardWidth: 500,
  hovered: false,
  cardArrangement: "straight" as const,
};

describe("StackedCard", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mocks before each test
    mockGetCardContent.mockImplementation(
      (questionIdxTemp: number, offset: number): JSX.Element => (
        <div data-testid="card-content">
          Question {questionIdxTemp}, Offset {offset}
        </div>
      )
    );
    mockCardRefs.current = [];
  });

  test("renders with basic props and displays content when offset is 0", () => {
    render(<StackedCard {...defaultProps} />);

    // Use act with vi.advanceTimersByTime to properly control the timing
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("card-content")).toBeInTheDocument();
    expect(screen.getByText("Question 0, Offset 0")).toBeInTheDocument();
  });

  test("renders dummy content when offset is not 0", () => {
    render(<StackedCard {...defaultProps} offset={1} />);
    const cardContainer = screen.getByTestId("questionCard-0");
    expect(cardContainer).toBeInTheDocument();
    expect(mockGetCardContent).not.toHaveBeenCalled();
  });

  test("applies correct styles for straight card arrangement", () => {
    render(<StackedCard {...defaultProps} cardArrangement="straight" />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("transform: translateY(-0px)");
    expect(card).toHaveStyle("width: 100%");
    expect(card).toHaveStyle("margin: auto");
  });

  test("applies correct styles for casual card arrangement", () => {
    render(<StackedCard {...defaultProps} cardArrangement="casual" />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("transform: translateX(0) rotate(-0deg)");
  });

  test("applies correct styles for default card arrangement (simple)", () => {
    render(<StackedCard {...defaultProps} cardArrangement="simple" />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("transform: translateX(0)");
  });

  test("applies hidden styles when offset is negative", () => {
    render(<StackedCard {...defaultProps} offset={-1} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("opacity: 0");
  });

  test("applies bottom styles if survey type is not link", () => {
    render(<StackedCard {...defaultProps} survey={{ ...mockSurvey, type: "app" }} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("bottom: 0px");
  });

  test("does not apply bottom styles if survey type is link", () => {
    render(<StackedCard {...defaultProps} survey={{ ...mockSurvey, type: "link" }} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).not.toHaveStyle("bottom: 0px");
  });

  test("adjusts rotation coefficient based on cardWidth for casual arrangement", () => {
    // Test with cardWidth >= 1000
    render(
      <StackedCard {...defaultProps} cardArrangement="casual" cardWidth={1000} offset={1} hovered={true} />
    );
    let card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("transform: translateX(0) rotate(-1.5deg)");
    cleanup(); // Clean up before next render

    // Test with cardWidth > 650 and < 1000
    render(
      <StackedCard {...defaultProps} cardArrangement="casual" cardWidth={700} offset={1} hovered={true} />
    );
    card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("transform: translateX(0) rotate(-2deg)");
    cleanup(); // Clean up before next render

    // Test with cardWidth <= 650
    render(
      <StackedCard {...defaultProps} cardArrangement="casual" cardWidth={600} offset={1} hovered={true} />
    );
    card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("transform: translateX(0) rotate(-3deg)");
  });

  test("sets content opacity to 1 after delay when offset is 0", async () => {
    vi.useFakeTimers();
    render(<StackedCard {...defaultProps} offset={0} />);
    const contentDiv = screen.getByTestId("card-content").parentElement;

    // Initially, opacity might be 0 or transitioning
    // We advance timers to check the final state
    act(() => {
      vi.advanceTimersByTime(300); // For delayedOffset
      vi.advanceTimersByTime(300); // For contentOpacity
    });

    expect(contentDiv).toHaveStyle("opacity: 1");
    vi.useRealTimers();
  });

  test("card height is auto when offset is 0 and not fullSizeCards", () => {
    render(<StackedCard {...defaultProps} offset={0} fullSizeCards={false} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("height: auto");
  });

  test("card height is initial when offset is < 0 and not fullSizeCards", () => {
    render(<StackedCard {...defaultProps} offset={-1} fullSizeCards={false} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("height: initial");
  });

  test("card height is cardHeight when offset > 0 and not fullSizeCards", () => {
    render(<StackedCard {...defaultProps} offset={1} fullSizeCards={false} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle(`height: ${defaultProps.cardHeight}`);
  });

  test("card height is 100% when fullSizeCards is true", () => {
    render(<StackedCard {...defaultProps} fullSizeCards={true} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("height: 100%");
  });

  test("pointerEvents are auto when offset is 0", () => {
    render(<StackedCard {...defaultProps} offset={0} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("pointer-events: auto");
  });

  test("pointerEvents are none when offset is not 0", () => {
    render(<StackedCard {...defaultProps} offset={1} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle("pointer-events: none");
  });
});
