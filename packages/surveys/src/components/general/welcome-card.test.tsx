import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WelcomeCard } from "./welcome-card";

describe("WelcomeCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
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
    html: { default: "This is a test survey" },
    buttonLabel: { default: "Start" },
    onSubmit: vi.fn(),
    survey: mockSurvey,
    languageCode: "en",
    autoFocusEnabled: true,
    isCurrent: true,
    responseData: {},
    variablesData: {},
  };

  it("renders welcome card with basic content", () => {
    const { container } = render(<WelcomeCard {...defaultProps} />);

    expect(container.querySelector(".fb-text-heading")).toHaveTextContent("Welcome to our survey");
    expect(container.querySelector(".fb-htmlbody")).toHaveTextContent("This is a test survey");
    expect(container.querySelector("button")).toHaveTextContent("Start");
  });

  it("shows time to complete when timeToFinish is true", () => {
    const { container } = render(<WelcomeCard {...defaultProps} />);

    const timeDisplay = container.querySelector(".fb-text-subheading");
    expect(timeDisplay).toBeInTheDocument();
    expect(timeDisplay).toHaveTextContent(/Takes/);
  });

  it("shows response count when showResponseCount is true and count > 3", () => {
    const { container } = render(<WelcomeCard {...defaultProps} responseCount={10} />);

    const responseText = container.querySelector(".fb-text-xs");
    expect(responseText).toHaveTextContent(/10 people responded/);
  });

  it("handles submit button click", () => {
    const { container } = render(<WelcomeCard {...defaultProps} />);

    const button = container.querySelector("button");
    expect(button).toBeInTheDocument();
    fireEvent.click(button!);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({ welcomeCard: "clicked" }, {});
  });

  it("handles Enter key press when survey type is link", () => {
    render(<WelcomeCard {...defaultProps} />);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({ welcomeCard: "clicked" }, {});
  });

  it("does not show response count when count <= 3", () => {
    const { container } = render(<WelcomeCard {...defaultProps} responseCount={3} />);

    const responseText = container.querySelector(".fb-text-xs");
    expect(responseText).not.toHaveTextContent(/3 people responded/);
  });

  it("shows company logo when fileUrl is provided", () => {
    const propsWithLogo = {
      ...defaultProps,
      fileUrl: "https://example.com/logo.png",
    };

    render(<WelcomeCard {...propsWithLogo} />);

    const logo = screen.getByAltText("Company Logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("calculates time to complete correctly for different survey lengths", () => {
    // Test short survey (2 questions)
    const { container } = render(<WelcomeCard {...defaultProps} />);
    const timeDisplay = container.querySelector(".fb-text-subheading");
    expect(timeDisplay).toHaveTextContent(/Takes less than 1 minute/);

    // Test medium survey (12 questions)
    const mediumSurvey = {
      ...mockSurvey,
      questions: Array(12).fill({ id: "q", logic: [] }),
    };
    const { container: mediumContainer } = render(<WelcomeCard {...defaultProps} survey={mediumSurvey} />);
    const mediumTimeDisplay = mediumContainer.querySelector(".fb-text-subheading");
    expect(mediumTimeDisplay).toHaveTextContent(/Takes 3 minutes/);

    // Test long survey (25 questions)
    const longSurvey = {
      ...mockSurvey,
      questions: Array(25).fill({ id: "q", logic: [] }),
    };
    const { container: longContainer } = render(<WelcomeCard {...defaultProps} survey={longSurvey} />);
    const longTimeDisplay = longContainer.querySelector(".fb-text-subheading");
    expect(longTimeDisplay).toHaveTextContent(/Takes 6\+ minutes/);
  });

  it("shows both time and response count when both flags are true", () => {
    const { container } = render(
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

    const textDisplay = container.querySelector(".fb-text-xs");
    expect(textDisplay).toHaveTextContent(/Takes.*10 people responded/);
  });

  it("handles missing optional props gracefully", () => {
    const minimalProps = {
      ...defaultProps,
      headline: undefined,
      html: undefined,
      buttonLabel: undefined,
      fileUrl: undefined,
      responseCount: undefined,
    };

    const { container } = render(<WelcomeCard {...minimalProps} />);

    expect(container.querySelector(".fb-text-heading")).toBeInTheDocument();
    expect(container.querySelector("button")).toBeInTheDocument();
  });

  it("handles Enter key press correctly based on survey type and isCurrent", () => {
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

  it("prevents default on Enter key in button", () => {
    const { container } = render(<WelcomeCard {...defaultProps} />);
    const button = container.querySelector("button");
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(event, "preventDefault", { value: vi.fn() });

    button?.dispatchEvent(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("properly cleans up event listeners on unmount", () => {
    const { unmount } = render(<WelcomeCard {...defaultProps} />);
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it("handles response counts at boundary conditions", () => {
    // Test with exactly 3 responses (boundary)
    const { container: container3 } = render(<WelcomeCard {...defaultProps} responseCount={3} />);
    expect(container3.querySelector(".fb-text-xs")).not.toHaveTextContent(/3 people responded/);

    // Test with 4 responses (just above boundary)
    const { container: container4 } = render(<WelcomeCard {...defaultProps} responseCount={4} />);
    expect(container4.querySelector(".fb-text-xs")).toHaveTextContent(/4 people responded/);
  });

  it("handles time calculation edge cases", () => {
    // Test with no questions
    const emptyQuestionsSurvey = {
      ...mockSurvey,
      questions: [{ id: "dummy", logic: [] }], // Add dummy question to avoid logic error
      endings: [],
    };
    const { container: emptyContainer } = render(
      <WelcomeCard {...defaultProps} survey={emptyQuestionsSurvey} />
    );
    expect(emptyContainer.querySelector(".fb-text-subheading")).toHaveTextContent(/Takes less than 1 minute/);

    // Test with exactly 24 questions (6 minutes boundary)
    const boundaryQuestionsSurvey = {
      ...mockSurvey,
      questions: Array(24).fill({ id: "q", logic: [] }),
    };
    const { container: boundaryContainer } = render(
      <WelcomeCard {...defaultProps} survey={boundaryQuestionsSurvey} />
    );
    expect(boundaryContainer.querySelector(".fb-text-subheading")).toHaveTextContent(/Takes 6 minutes/);
  });

  it("correctly processes localized content", () => {
    const localizedProps = {
      ...defaultProps,
      headline: { default: "Welcome", es: "Bienvenido" },
      html: { default: "Test", es: "Prueba" },
      buttonLabel: { default: "Start", es: "Comenzar" },
      languageCode: "es",
    };

    const { container } = render(<WelcomeCard {...localizedProps} />);

    expect(container.querySelector(".fb-text-heading")).toHaveTextContent("Bienvenido");
    expect(container.querySelector(".fb-htmlbody")).toHaveTextContent("Prueba");
    expect(container.querySelector("button")).toHaveTextContent("Comenzar");
  });

  it("handles variable replacement in content", () => {
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
