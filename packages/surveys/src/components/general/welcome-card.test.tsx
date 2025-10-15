import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WelcomeCard } from "./welcome-card";

describe("WelcomeCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    cleanup();
  });

  const mockSurvey = {
    questions: [
      { id: "q1", logic: [] },
      { id: "q2", logic: [] },
    ],
    endings: [{ id: "end1" }],
    welcomeCard: {
      enabled: true,
      timeToFinish: true,
      showResponseCount: true,
    },
    type: "link",
  } as any;

  const defaultProps = {
    headline: { default: "Welcome to our survey" },
    subheader: { default: "This is a test survey" },
    buttonLabel: { default: "Start" },
    onSubmit: vi.fn(),
    survey: mockSurvey,
    languageCode: "en",
    autoFocusEnabled: true,
    isCurrent: true,
    responseData: {},
    variablesData: {},
  };

  test("renders welcome card with basic content", () => {
    const { container, getByTestId } = render(<WelcomeCard {...defaultProps} />);

    expect(container.querySelector(".fb-text-heading")).toHaveTextContent("Welcome to our survey");
    expect(getByTestId("subheader")).toHaveTextContent("This is a test survey");
    expect(container.querySelector("button")).toHaveTextContent("Start");
  });

  test("shows time to complete when timeToFinish is true", () => {
    const propsWithTimeOnly = {
      ...defaultProps,
      survey: {
        ...mockSurvey,
        welcomeCard: {
          ...mockSurvey.welcomeCard,
          timeToFinish: true,
          showResponseCount: false,
        },
      },
    };
    const { getByTestId } = render(<WelcomeCard {...propsWithTimeOnly} />);

    const timeDisplay = getByTestId("fb__surveys__welcome-card__time-display");
    expect(timeDisplay).toBeInTheDocument();
    expect(timeDisplay).toHaveTextContent(/common.takes/);
  });

  test("shows response count when showResponseCount is true and count > 3", () => {
    const { queryByTestId } = render(<WelcomeCard {...defaultProps} responseCount={10} />);

    const responseText = queryByTestId("fb__surveys__welcome-card__response-count");
    expect(responseText).toHaveTextContent(/common.people_responded/);
  });

  test("handles submit button click", () => {
    const { container } = render(<WelcomeCard {...defaultProps} />);

    const button = container.querySelector("button");
    expect(button).toBeInTheDocument();
    fireEvent.click(button!);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({ welcomeCard: "clicked" }, {});
  });

  test("handles Enter key press when survey type is link", () => {
    render(<WelcomeCard {...defaultProps} />);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({ welcomeCard: "clicked" }, {});
  });

  test("does not show response count when count <= 3", () => {
    const { queryByTestId } = render(<WelcomeCard {...defaultProps} responseCount={3} />);

    const responseText = queryByTestId("fb__surveys__welcome-card__response-count");
    expect(responseText).not.toHaveTextContent(/common.people_responded/);
  });

  test("shows company logo when fileUrl is provided", () => {
    const propsWithLogo = {
      ...defaultProps,
      fileUrl: "https://example.com/logo.png",
    };

    render(<WelcomeCard {...propsWithLogo} />);

    const logo = screen.getByAltText("common.company_logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
  });

  test("calculates time to complete correctly for different survey lengths", () => {
    // Test short survey (2 questions)
    const shortSurvey = {
      ...mockSurvey,
      welcomeCard: {
        ...mockSurvey.welcomeCard,
        timeToFinish: true,
        showResponseCount: false,
      },
    };
    const { getByTestId, unmount } = render(<WelcomeCard {...defaultProps} survey={shortSurvey} />);
    const timeDisplay = getByTestId("fb__surveys__welcome-card__time-display");
    expect(timeDisplay).toHaveTextContent(/common.takes common.less_than_x_minutes/);
    unmount();

    // Test medium survey (12 questions)
    const mediumSurvey = {
      ...mockSurvey,
      questions: Array(12).fill({ id: "q", logic: [] }),
      welcomeCard: {
        ...mockSurvey.welcomeCard,
        timeToFinish: true,
        showResponseCount: false,
      },
    };
    const { getByTestId: getByTestIdMedium, unmount: unmountMedium } = render(
      <WelcomeCard {...defaultProps} survey={mediumSurvey} />
    );
    const mediumTimeDisplay = getByTestIdMedium("fb__surveys__welcome-card__time-display");
    expect(mediumTimeDisplay).toHaveTextContent(/common.takes common.x_minutes/);
    unmountMedium();

    // Test long survey (25 questions)
    const longSurvey = {
      ...mockSurvey,
      questions: Array(25).fill({ id: "q", logic: [] }),
      welcomeCard: {
        ...mockSurvey.welcomeCard,
        timeToFinish: true,
        showResponseCount: false,
      },
    };
    const { getByTestId: getByTestIdLong } = render(<WelcomeCard {...defaultProps} survey={longSurvey} />);
    const longTimeDisplay = getByTestIdLong("fb__surveys__welcome-card__time-display");
    expect(longTimeDisplay).toHaveTextContent(/common.takes common.x_plus_minutes/);
  });

  test("shows both time and response count when both flags are true", () => {
    const { queryByTestId } = render(
      <WelcomeCard
        {...defaultProps}
        responseCount={10}
        survey={{
          ...mockSurvey,
          welcomeCard: {
            enabled: true,
            timeToFinish: true,
            showResponseCount: true,
          },
        }}
      />
    );

    const textDisplay = queryByTestId("fb__surveys__welcome-card__info-text-test");
    expect(textDisplay).toHaveTextContent(/common.takes.*common.people_responded/);
  });

  test("handles missing optional props gracefully", () => {
    const minimalProps = {
      ...defaultProps,
      headline: undefined,
      subheader: undefined,
      buttonLabel: undefined,
      fileUrl: undefined,
      responseCount: undefined,
    };

    const { container } = render(<WelcomeCard {...minimalProps} />);

    expect(container.querySelector(".fb-text-heading")).toBeInTheDocument();
    expect(container.querySelector("button")).toBeInTheDocument();
  });

  test("handles Enter key press correctly based on survey type and isCurrent", () => {
    const mockOnSubmit = vi.fn();
    // Test when survey is not link type
    const { rerender, unmount } = render(
      <WelcomeCard {...defaultProps} onSubmit={mockOnSubmit} survey={{ ...mockSurvey, type: "web" }} />
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(mockOnSubmit).not.toHaveBeenCalled();

    // Test when not current
    rerender(<WelcomeCard {...defaultProps} onSubmit={mockOnSubmit} isCurrent={false} />);

    fireEvent.keyDown(document, { key: "Enter" });
    expect(mockOnSubmit).not.toHaveBeenCalled();

    // Clean up
    unmount();
  });

  test("prevents default on Enter key in button", () => {
    const { container } = render(<WelcomeCard {...defaultProps} />);
    const button = container.querySelector("button");
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(event, "preventDefault", { value: vi.fn() });

    button?.dispatchEvent(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("properly cleans up event listeners on unmount", () => {
    const { unmount } = render(<WelcomeCard {...defaultProps} />);
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  test("handles response counts at boundary conditions", () => {
    // Test with exactly 3 responses (boundary)
    const { queryByTestId: queryByTestId3, unmount } = render(
      <WelcomeCard {...defaultProps} responseCount={3} />
    );
    expect(queryByTestId3("fb__surveys__welcome-card__response-count")).not.toHaveTextContent(
      /common.people_responded/
    );

    // unmount to not have conflicting test ids
    unmount();

    // Test with 4 responses (just above boundary)
    const { queryByTestId: queryByTestId4 } = render(<WelcomeCard {...defaultProps} responseCount={4} />);
    expect(queryByTestId4("fb__surveys__welcome-card__response-count")).toHaveTextContent(
      /common.people_responded/
    );
  });

  test("handles time calculation edge cases", () => {
    // Test with no questions
    const emptyQuestionsSurvey = {
      ...mockSurvey,
      questions: [{ id: "dummy", logic: [] }], // Add dummy question to avoid logic error
      endings: [],
      welcomeCard: {
        ...mockSurvey.welcomeCard,
        timeToFinish: true,
        showResponseCount: false,
      },
    };
    const { getByTestId: getByTestIdEmpty, unmount: unmountEmpty } = render(
      <WelcomeCard {...defaultProps} survey={emptyQuestionsSurvey} />
    );
    expect(getByTestIdEmpty("fb__surveys__welcome-card__time-display")).toHaveTextContent(
      /common.takes common.less_than_x_minutes/
    );
    unmountEmpty();

    // Test with exactly 24 questions (6 minutes boundary)
    const boundaryQuestionsSurvey = {
      ...mockSurvey,
      questions: Array(24).fill({ id: "q", logic: [] }),
      welcomeCard: {
        ...mockSurvey.welcomeCard,
        timeToFinish: true,
        showResponseCount: false,
      },
    };
    const { getByTestId: getByTestIdBoundary } = render(
      <WelcomeCard {...defaultProps} survey={boundaryQuestionsSurvey} />
    );
    expect(getByTestIdBoundary("fb__surveys__welcome-card__time-display")).toHaveTextContent(
      /common.takes common.x_minutes/
    );
  });

  test("correctly processes localized content", () => {
    const localizedProps = {
      ...defaultProps,
      headline: { default: "Welcome", es: "Bienvenido" },
      subheader: { default: "Test", es: "Prueba" },
      buttonLabel: { default: "Start", es: "Comenzar" },
      languageCode: "es",
    };

    const { container, getByTestId } = render(<WelcomeCard {...localizedProps} />);

    expect(container.querySelector(".fb-text-heading")).toHaveTextContent("Bienvenido");
    expect(getByTestId("subheader")).toHaveTextContent("Prueba");
    expect(container.querySelector("button")).toHaveTextContent("Comenzar");
  });

  test("handles variable replacement in content", () => {
    const propsWithVariables = {
      ...defaultProps,
      headline: { default: "Welcome #recall:name/fallback:Guest#" },
      responseData: { name: "John" },
      variablesData: {},
      survey: {
        ...mockSurvey,
        questions: [{ id: "q1", logic: [] }],
        welcomeCard: {
          enabled: true,
          timeToFinish: false,
          showResponseCount: false,
        },
      },
    };

    const { container } = render(<WelcomeCard {...propsWithVariables} />);
    expect(container.querySelector(".fb-text-heading")).toHaveTextContent("Welcome John");
  });
});
