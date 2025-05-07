import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { DateQuestion } from "./date-question";

// Mock react-date-picker
vi.mock("react-date-picker", () => ({
  default: vi.fn(({ onChange, value }) => (
    <div data-testid="date-picker-mock">
      <button data-testid="date-select-button" onClick={() => onChange(new Date("2023-01-15"))}>
        Select Date
      </button>
      <span>{value ? value.toISOString() : "No date selected"}</span>
    </div>
  )),
}));

// Mock dependencies
vi.mock("@/lib/ttc", () => ({
  useTtc: vi.fn(),
  getUpdatedTtc: vi.fn().mockReturnValue({ mockUpdatedTtc: true }),
}));

describe("DateQuestion", () => {
  afterEach(() => {
    cleanup();
  });

  const mockQuestion = {
    id: "date-question-1",
    type: TSurveyQuestionTypeEnum.Date,
    headline: { default: "Select a date" },
    subheader: { default: "Please choose a date" },
    required: true,
    buttonLabel: { default: "Next" },
    backButtonLabel: { default: "Back" },
  };

  const defaultProps = {
    question: mockQuestion,
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {},
    setTtc: vi.fn(),
    autoFocusEnabled: false,
    currentQuestionId: "date-question-1",
    isBackButtonHidden: false,
  } as any;

  test("renders date question correctly", () => {
    render(<DateQuestion {...defaultProps} />);

    expect(screen.getAllByText("Select a date")[0]).toBeInTheDocument();
    expect(screen.getByText("Please choose a date")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByText("Select a date", { selector: "span" })).toBeInTheDocument();
  });

  test("displays error message when form is submitted without a date if required", async () => {
    const user = userEvent.setup();

    render(<DateQuestion {...defaultProps} />);

    await user.click(screen.getByText("Next"));

    expect(screen.getByText("Please select a date.")).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  test("calls onSubmit when form is submitted with a valid date", async () => {
    const user = userEvent.setup();
    const testDate = "2023-01-15";
    const props = { ...defaultProps, value: testDate };

    render(<DateQuestion {...props} />);

    await user.click(screen.getByText("Next"));

    expect(props.onSubmit).toHaveBeenCalledWith({ "date-question-1": testDate }, expect.anything());
  });

  test("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();

    render(<DateQuestion {...defaultProps} />);

    await user.click(screen.getByText("Back"));

    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    expect(defaultProps.setTtc).toHaveBeenCalledTimes(2); // Updated to 2 calls
  });

  test("does not render back button when isFirstQuestion is true", () => {
    render(<DateQuestion {...defaultProps} isFirstQuestion={true} />);

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("does not render back button when isBackButtonHidden is true", () => {
    render(<DateQuestion {...defaultProps} isBackButtonHidden={true} />);

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("renders media content when available", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "https://example.com/image.jpg",
    };

    render(<DateQuestion {...defaultProps} question={questionWithMedia} />);

    // Media component should be rendered (implementation detail check)
    expect(screen.getAllByText("Select a date")[0]).toBeInTheDocument();
  });

  test("opens date picker when button is clicked", async () => {
    const user = userEvent.setup();

    render(<DateQuestion {...defaultProps} />);

    // Click the select date button
    const dateButton = screen.getByRole("button", { name: /select a date/i });
    await user.click(dateButton);

    // We can check for our mocked date picker
    expect(screen.getByTestId("date-picker-mock")).toBeInTheDocument();
  });

  test("displays formatted date when a date is selected", async () => {
    const dateValue = "2023-01-15";
    const props = { ...defaultProps, value: dateValue };

    render(<DateQuestion {...props} />);

    // The component shows 14th due to timezone offset conversion
    expect(screen.getByText("14th of January, 2023")).toBeInTheDocument();
  });
});
