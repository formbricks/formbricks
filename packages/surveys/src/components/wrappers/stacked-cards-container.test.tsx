// Import jest-dom matchers explicitly for Vitest
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
// Import after mocks
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TProjectStyling } from "@formbricks/types/project";
import { TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurveyQuestionId, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { StackedCardsContainer } from "./stacked-cards-container";

// Create a mock for StackedCard - must be defined before the mock
const mockStackedCardFn = vi.fn();

// Mock dependencies
vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// Mock the StackedCard component
vi.mock("./stacked-card", () => ({
  StackedCard: (props: any) => {
    mockStackedCardFn(props);

    const ref = (el: HTMLDivElement | null) => {
      if (props.cardRefs?.current) {
        props.cardRefs.current[props.dynamicQuestionIndex] = el;
      }
    };

    return (
      <div
        data-testid={`stacked-card-${props.dynamicQuestionIndex}`}
        data-offset={props.offset}
        data-surveyid={props.survey.id}
        data-fullsize={props.fullSizeCards.toString()}
        data-cardarrangement={props.cardArrangement}
        data-hovered={props.hovered.toString()}
        style={{
          ...props.borderStyles,
          height: props.cardHeight,
          width: props.cardWidth ? `${props.cardWidth}px` : "auto",
        }}
        ref={ref}>
        Mocked StackedCard: Q{props.dynamicQuestionIndex}, Offset {props.offset}
        {props.offset === 0 && props.getCardContent(props.dynamicQuestionIndex, props.offset)}
      </div>
    );
  },
}));

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
const mockUnobserve = vi.fn();

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
}));

const mockSurvey: TJsEnvironmentStateSurvey = {
  id: "survey-1",
  name: "Test Survey",
  type: "app",
  status: "inProgress",
  questions: [
    {
      id: "q1",
      headline: { default: "Q1" },
      type: TSurveyQuestionTypeEnum.OpenText,
      required: true,
      logic: [],
      isDraft: false,
      inputType: "text",
      charLimit: { enabled: false },
      longAnswer: false,
    },
    {
      id: "q2",
      headline: { default: "Q2" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      required: true,
      choices: [{ id: "c1", label: { default: "Choice1" } }],
      logic: [],
      isDraft: false,
      shuffleOption: "none",
    },
    {
      id: "q3",
      headline: { default: "Q3" },
      type: TSurveyQuestionTypeEnum.Rating,
      required: true,
      scale: "number",
      range: 5,
      logic: [],
      isDraft: false,
      isColorCodingEnabled: false,
    },
  ],
  variables: [],
  welcomeCard: {
    enabled: true,
    headline: { default: "Welcome!" },
    html: { default: "Welcome text" },
    timeToFinish: false,
    showResponseCount: false,
    buttonLabel: { default: "Start" },
  },
  endings: [
    {
      type: "endScreen",
      id: "ending-1",
      headline: { default: "Thank You!" },
      subheader: { default: "All done." },
    },
  ],
  hiddenFields: { enabled: false, fieldIds: [] },
  languages: [
    {
      language: {
        id: "lang-id-1",
        code: "en",
        alias: null,
        projectId: "proj-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      default: true,
      enabled: true,
    },
  ],
  triggers: [],
  displayOption: "displayOnce",
  displayPercentage: null,
  autoClose: null,
  delay: 0,
  projectOverwrites: null,
  isBackButtonHidden: false,
  recaptcha: null,
  styling: {
    overwriteThemeStyling: false,
    highlightBorderColor: { light: "#highlight", dark: "#highlight_dark" },
    cardBorderColor: { light: "#cardborder", dark: "#cardborder_dark" },
  },
  recontactDays: null,
  displayLimit: null,
  segment: null,
  showLanguageSwitch: false,
};

const mockProjectStyling: TProjectStyling = {
  allowStyleOverwrite: true,
  hideProgressBar: false,
  isLogoHidden: false,
  highlightBorderColor: { light: "#projHighlight", dark: "#projHighlight_dark" },
  cardBorderColor: { light: "#projCardBorder", dark: "#projCardBorder_dark" },
  brandColor: { light: "#brand", dark: "#brand_dark" },
  cardBackgroundColor: { light: "#projCardBg", dark: "#projCardBg_dark" },
  cardShadowColor: { light: "#projCardShadow", dark: "#projCardShadow_dark" },
  questionColor: { light: "#projQ", dark: "#projQ_dark" },
  inputColor: { light: "#projInput", dark: "#projInput_dark" },
  inputBorderColor: { light: "#projInputBorder", dark: "#projInputBorder_dark" },
  cardArrangement: {
    linkSurveys: "straight",
    appSurveys: "straight",
  },
  roundness: 8,
};

const mockGetCardContent = vi.fn();
const mockSetQuestionId = vi.fn();

const defaultProps = {
  cardArrangement: "straight" as TCardArrangementOptions,
  currentQuestionId: "q1" as TSurveyQuestionId,
  survey: mockSurvey,
  getCardContent: mockGetCardContent,
  styling: mockProjectStyling,
  setQuestionId: mockSetQuestionId,
  shouldResetQuestionId: true,
  fullSizeCards: false,
};

describe("StackedCardsContainer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    // Reset ResizeObserver mocks explicitly if they maintain state across tests
    mockObserve.mockClear();
    mockDisconnect.mockClear();
    mockUnobserve.mockClear();
    (global.ResizeObserver as any).mockClear();
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
    }));
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mockGetCardContent.mockImplementation((questionIdxTemp, offset) => (
      <div data-testid={`card-content-${questionIdxTemp}-${offset}`}>
        Content for Q{questionIdxTemp}, Offset {offset}
      </div>
    ));
  });

  test("renders simple arrangement correctly", () => {
    render(<StackedCardsContainer {...defaultProps} cardArrangement="simple" />);
    const card = screen.getByTestId("questionCard-0"); // q1 is index 0
    expect(card).toBeInTheDocument();
    expect(mockGetCardContent).toHaveBeenCalledWith(0, 0);
    expect(mockStackedCardFn).not.toHaveBeenCalled();
    // Check border style individually instead of as one combined style
    expect(card).toHaveStyle({ borderColor: mockProjectStyling.highlightBorderColor?.light });
  });

  test("renders simple arrangement with fullSizeCards", () => {
    render(<StackedCardsContainer {...defaultProps} cardArrangement="simple" fullSizeCards={true} />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveClass("fb-h-full");
  });

  test("renders stacked arrangement correctly", () => {
    render(<StackedCardsContainer {...defaultProps} cardArrangement="casual" />);
    // q1 is index 0. currentQuestionIdx = 0. prev = -1, next = 1, next+1 = 2
    expect(mockStackedCardFn).toHaveBeenCalledTimes(4); // prev, current, next, next+1
    expect(screen.getByTestId("stacked-card-0")).toBeInTheDocument(); // current
    expect(screen.getByTestId("stacked-card-1")).toBeInTheDocument(); // next
    // Check that getCardContent is called for the current card (offset 0) via the mock
    const currentCardCall = mockStackedCardFn.mock.calls.find((call) => call[0].offset === 0);
    expect(currentCardCall).toBeDefined();
    expect(currentCardCall?.[0].getCardContent).toBe(mockGetCardContent);
    // Ensure card content for current card is rendered by the mock
    expect(screen.getByTestId("card-content-0-0")).toBeInTheDocument();
  });

  test("handles mouse enter and leave events", () => {
    render(<StackedCardsContainer {...defaultProps} cardArrangement="casual" />);
    const container = screen.getByTestId("stacked-cards-container");

    fireEvent.mouseEnter(container);
    // Check if hovered=true is passed to StackedCard
    // Last call to StackedCard for the current card (offset 0) should have hovered = true
    act(() => {
      vi.runAllTimers();
    }); // allow state updates to propagate
    let currentCardCall = mockStackedCardFn.mock.calls.filter((call) => call[0].offset === 0).pop();
    expect(currentCardCall?.[0].hovered).toBe(true);

    fireEvent.mouseLeave(container);
    act(() => {
      vi.runAllTimers();
    });
    currentCardCall = mockStackedCardFn.mock.calls.filter((call) => call[0].offset === 0).pop();
    expect(currentCardCall?.[0].hovered).toBe(false);
  });

  test("updates question indices on currentQuestionId change (next question)", () => {
    const { rerender } = render(<StackedCardsContainer {...defaultProps} currentQuestionId="q1" />); // q1 -> index 0
    // Initial state: currentIdx = 0, prev = -1, next = 1

    rerender(<StackedCardsContainer {...defaultProps} currentQuestionId="q2" />); // q2 -> index 1
    // Expected: currentIdx = 1, prev = 0 (visited[...]), next = 2
    act(() => {
      vi.runAllTimers();
    });

    // Check props passed to StackedCard to infer internal state
    const calls = mockStackedCardFn.mock.calls;
    const currentCardCall = calls.filter((call) => call[0].offset === 0).pop(); // Last current card
    expect(currentCardCall?.[0].dynamicQuestionIndex).toBe(1); // q2

    const prevCardCall = calls.filter((call) => call[0].offset === -1).pop();
    expect(prevCardCall?.[0].dynamicQuestionIndex).toBe(0); // q1
  });

  test("updates question indices on currentQuestionId change (back question)", () => {
    // Simulate going q1 -> q2 -> q1
    const { rerender } = render(<StackedCardsContainer {...defaultProps} currentQuestionId="q1" />);
    act(() => {
      vi.runAllTimers();
    });
    rerender(<StackedCardsContainer {...defaultProps} currentQuestionId="q2" />); // currentIdx = 1, visited = [0]
    act(() => {
      vi.runAllTimers();
    });
    rerender(<StackedCardsContainer {...defaultProps} currentQuestionId="q1" />); // currentIdx = 0, prev = visited[-2] (should be undefined, so prev remains -1 or similar)
    // The logic for prevQuestionIdx on back: visitedQuestions[visitedQuestions.length - 2]
    // visited: [0] -> q2 -> visited: [0,0] (bug in logic if prevQuestionIdx is currentQuestionIdx)
    // Let's trace:
    // Initial: q1 (idx 0). current=0, prev=-1, next=1. visited=[]
    // To q2 (idx 1): questionIdxTemp=1 > currentIdx=0. prev=0, current=1, next=2. visited=[0]
    // To q1 (idx 0): questionIdxTemp=0 < currentIdx=1. next=1, current=0. prev=visited[visited.length-2] = visited[-1] -> undefined.
    // If prev is undefined, it might default or cause issues. The component seems to handle it.
    // Let's check the StackedCard calls.
    act(() => {
      vi.runAllTimers();
    });

    const calls = mockStackedCardFn.mock.calls;
    const currentCardCall = calls.filter((call) => call[0].offset === 0).pop();
    expect(currentCardCall?.[0].dynamicQuestionIndex).toBe(0); // q1

    const nextCardCall = calls.filter((call) => call[0].offset === 1).pop();
    expect(nextCardCall?.[0].dynamicQuestionIndex).toBe(1); // q2
  });

  test("calculates questionIdxTemp for 'start' id with welcome card enabled", () => {
    render(
      <StackedCardsContainer
        {...defaultProps}
        currentQuestionId="start"
        survey={{ ...mockSurvey, welcomeCard: { ...mockSurvey.welcomeCard, enabled: true } }}
      />
    );
    // Expected questionIdxTemp = -1 (welcome card)
    // This means currentQuestionIdx in state will be -1.
    const currentCardCall = mockStackedCardFn.mock.calls.filter((call) => call[0].offset === 0).pop();
    expect(currentCardCall?.[0].dynamicQuestionIndex).toBe(-1); // Welcome card
  });

  test("calculates questionIdxTemp for 'start' id with welcome card disabled", () => {
    render(
      <StackedCardsContainer
        {...defaultProps}
        currentQuestionId="start"
        survey={{ ...mockSurvey, welcomeCard: { ...mockSurvey.welcomeCard, enabled: false } }}
      />
    );
    // Expected questionIdxTemp = 0 (first question)
    const currentCardCall = mockStackedCardFn.mock.calls.filter((call) => call[0].offset === 0).pop();
    expect(currentCardCall?.[0].dynamicQuestionIndex).toBe(0); // First question
  });

  test("calculates questionIdxTemp for ending card (ID not in questions)", () => {
    render(<StackedCardsContainer {...defaultProps} currentQuestionId="ending-1" />);
    // Expected questionIdxTemp = survey.questions.length (3)
    const currentCardCall = mockStackedCardFn.mock.calls.filter((call) => call[0].offset === 0).pop();
    expect(currentCardCall?.[0].dynamicQuestionIndex).toBe(mockSurvey.questions.length);
  });

  test("correctly computes borderStyles with survey styling override", () => {
    const surveyWithOverride = {
      ...mockSurvey,
      styling: {
        ...mockSurvey.styling,
        overwriteThemeStyling: true,
        highlightBorderColor: { light: "#surveyHighlight", dark: "" },
        cardBorderColor: { light: "#surveyCardBorder", dark: "" },
      },
    };
    render(<StackedCardsContainer {...defaultProps} survey={surveyWithOverride} cardArrangement="simple" />);
    const card = screen.getByTestId("questionCard-0");
    expect(card).toHaveStyle({ borderColor: "#surveyHighlight" });
  });

  test("correctly computes borderStyles for link survey type", () => {
    const linkSurvey = { ...mockSurvey, type: "link" as const };
    render(<StackedCardsContainer {...defaultProps} survey={linkSurvey} cardArrangement="simple" />);
    const card = screen.getByTestId("questionCard-0");
    // Should use cardBorderColor from project styling as overwrite is false and type is link
    expect(card).toHaveStyle({ borderColor: mockProjectStyling.cardBorderColor?.light });
  });

  test("correctly computes borderStyles when highlightBorderColor is undefined", () => {
    const stylingWithoutHighlight = { ...mockProjectStyling, highlightBorderColor: undefined };
    render(
      <StackedCardsContainer {...defaultProps} styling={stylingWithoutHighlight} cardArrangement="simple" />
    );
    const card = screen.getByTestId("questionCard-0");
    // Should use cardBorderColor
    expect(card).toHaveStyle({ borderColor: mockProjectStyling.cardBorderColor?.light });
  });

  test("ResizeObserver setup and callback for STACKED layout", async () => {
    render(<StackedCardsContainer {...defaultProps} cardArrangement="casual" currentQuestionId="q1" />); // q1 is index 0

    act(() => {
      vi.runAllTimers();
    }); // For the setTimeout(0) in useEffect

    expect(mockObserve).toHaveBeenCalledTimes(1);
    const observedElement = mockObserve.mock.calls[0][0];
    // The observed element should be the one from cardRefs.current[0] (current card)
    // Our MockStackedCard populates cardRefs.current[dynamicQuestionIndex]
    // So cardRefs.current[0] should be the div of the mocked StackedCard for q1.
    expect(observedElement).toBeDefined();
    expect(observedElement.getAttribute("data-testid")).toBe("stacked-card-0");

    const resizeCallback = (global.ResizeObserver as any).mock.calls[0][0];
    act(() => {
      resizeCallback([{ contentRect: { height: 500, width: 300 } }]);
    });

    // Check that cardHeight and cardWidth are passed to StackedCard instances (e.g., next card)
    // Need to wait for re-render if state update is async
    await waitFor(() => {
      const nextCardCall = mockStackedCardFn.mock.calls.filter((call) => call[0].offset === 1).pop();
      expect(nextCardCall).toBeDefined();
      if (nextCardCall) {
        expect(nextCardCall[0].cardHeight).toBe("500px");
        expect(nextCardCall[0].cardWidth).toBe(300);
      }
    });
    expect(mockDisconnect).not.toHaveBeenCalled(); // Should not disconnect unless component unmounts or deps change
  });

  test("ResizeObserver does not attach if currentElement is not found (e.g. simple mode without ref)", () => {
    // In simple mode, the component does not assign to cardRefs.current[questionIdxTemp] for the observed div
    render(<StackedCardsContainer {...defaultProps} cardArrangement="simple" currentQuestionId="q1" />);
    act(() => {
      vi.runAllTimers();
    });
    expect(mockObserve).not.toHaveBeenCalled(); // Because cardRefs.current[0] would be undefined
  });

  test("useEffect resets questionId when cardArrangement changes", () => {
    mockSetQuestionId.mockClear(); // Clear any previous calls
    const { rerender } = render(
      <StackedCardsContainer {...defaultProps} cardArrangement="simple" currentQuestionId="q2" />
    );

    // Clear the initial call that may happen during initial render
    mockSetQuestionId.mockClear();

    rerender(<StackedCardsContainer {...defaultProps} cardArrangement="casual" currentQuestionId="q2" />);
    expect(mockSetQuestionId).toHaveBeenCalledTimes(1);
    // Welcome card enabled, so should reset to "start"
    expect(mockSetQuestionId).toHaveBeenCalledWith("start");
  });

  test("useEffect does not reset questionId if shouldResetQuestionId is false", () => {
    const { rerender } = render(
      <StackedCardsContainer {...defaultProps} cardArrangement="simple" shouldResetQuestionId={false} />
    );
    rerender(
      <StackedCardsContainer {...defaultProps} cardArrangement="casual" shouldResetQuestionId={false} />
    );
    expect(mockSetQuestionId).not.toHaveBeenCalled();
  });

  test("hides extra cards if dynamicQuestionIndex exceeds available questions/endings", () => {
    const surveyWithFewQuestions: TJsEnvironmentStateSurvey = {
      ...mockSurvey,
      questions: [mockSurvey.questions[0]], // Only one question
      endings: [], // No ending card
    };
    render(
      <StackedCardsContainer
        {...defaultProps}
        survey={surveyWithFewQuestions}
        cardArrangement="casual"
        currentQuestionId="q1"
      />
    );
    // Current index 0. questions.length = 1. hasEndingCard = false.
    // Max dynamicQuestionIndex = 1 + (false ? 0 : -1) = 0.
    // Cards rendered: prev (-1), current (0), next (1), next+1 (2)
    // dynamicQuestionIndex > 0 should be hidden.
    // So, StackedCard for index 1 and 2 should not be rendered or should be filtered out.
    // The map function will run, but the condition inside will prevent rendering.
    // Let's check how many times StackedCard was called.
    expect(mockStackedCardFn).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("stacked-card-1")).not.toBeInTheDocument();
  });

  test("fullSizeCards prop is passed to StackedCard", () => {
    render(<StackedCardsContainer {...defaultProps} cardArrangement="casual" fullSizeCards={true} />);
    const currentCardCall = mockStackedCardFn.mock.calls.find((call) => call[0].offset === 0);
    expect(currentCardCall?.[0].fullSizeCards).toBe(true);
  });

  test("unmount component disconnects resize observer", () => {
    const { unmount } = render(<StackedCardsContainer {...defaultProps} cardArrangement="casual" />);
    act(() => {
      vi.runAllTimers();
    }); // Setup observer
    expect(mockObserve).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  vi.useRealTimers();
});
