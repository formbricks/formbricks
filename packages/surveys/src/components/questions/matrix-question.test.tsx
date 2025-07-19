import { getShuffledRowIndices } from "@/lib/utils";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyMatrixQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { MatrixQuestion } from "./matrix-question";

// Mock dependencies
vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, languageCode) => {
    if (typeof value === "string") return value;
    return value[languageCode] ?? value.default ?? "";
  }),
}));

vi.mock("@/lib/ttc", () => ({
  useTtc: vi.fn(),
  getUpdatedTtc: vi.fn((ttc) => ttc),
}));

// Fix the utils mock to handle all exports
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...(actual as Record<string, unknown>),
    getShuffledRowIndices: vi.fn((length) => Array.from({ length }, (_, i) => i)),
  };
});

// Mock components that might make tests more complex
vi.mock("@/components/general/question-media", () => ({
  QuestionMedia: ({ imgUrl, videoUrl }: { imgUrl?: string; videoUrl?: string }) =>
    imgUrl ? <img src={imgUrl} alt="Question media" /> : videoUrl ? <video src={videoUrl}></video> : null, // NOSONAR
}));

vi.mock("@/components/wrappers/scrollable-container", () => ({
  ScrollableContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("MatrixQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    question: {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate our services" },
      subheader: { default: "Please rate the following services" },
      required: true,
      shuffleOption: "none",
      rows: [
        { id: "row1", label: { default: "Service 1" } },
        { id: "row2", label: { default: "Service 2" } },
        { id: "row3", label: { default: "Service 3" } },
      ],
      columns: [
        { id: "col1", label: { default: "Poor" } },
        { id: "col2", label: { default: "Fair" } },
        { id: "col3", label: { default: "Good" } },
        { id: "col4", label: { default: "Excellent" } },
      ],
      buttonLabel: { default: "Next" },
      backButtonLabel: { default: "Back" },
      imageUrl: "",
      videoUrl: "",
    } as unknown as TSurveyMatrixQuestion,
    value: {},
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "default",
    ttc: {},
    setTtc: vi.fn(),
    currentQuestionId: "matrix-q1",
    isBackButtonHidden: false,
  };

  test("renders matrix question with correct rows and columns", () => {
    render(<MatrixQuestion {...defaultProps} />);

    expect(screen.getByText("Rate our services")).toBeInTheDocument();
    expect(screen.getByText("Please rate the following services")).toBeInTheDocument();

    expect(screen.getByText("Service 1")).toBeInTheDocument();
    expect(screen.getByText("Service 2")).toBeInTheDocument();
    expect(screen.getByText("Service 3")).toBeInTheDocument();

    expect(screen.getByText("Poor")).toBeInTheDocument();
    expect(screen.getByText("Fair")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();

    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  test("hides back button when isFirstQuestion is true", () => {
    render(<MatrixQuestion {...defaultProps} isFirstQuestion={true} />);
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("hides back button when isBackButtonHidden is true", () => {
    render(<MatrixQuestion {...defaultProps} isBackButtonHidden={true} />);
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("selects and deselects a radio button on click", async () => {
    const user = userEvent.setup();
    render(<MatrixQuestion {...defaultProps} />);

    // Find the first radio input cell by finding the intersection of row and column
    const firstRow = screen.getByText("Service 1").closest("tr");
    const firstCell = firstRow?.querySelector("td:first-of-type");
    expect(firstCell).toBeInTheDocument();

    await user.click(firstCell!);
    expect(defaultProps.onChange).toHaveBeenCalled();

    // Select the same option again should deselect it
    await user.click(firstCell!);
    expect(defaultProps.onChange).toHaveBeenCalledTimes(2);
  });

  test("selects a radio button with keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<MatrixQuestion {...defaultProps} />);

    // Find a specific row and a cell in that row
    const firstRow = screen.getByText("Service 1").closest("tr");
    // Get the third cell (which would be the "Good" column)
    const goodCell = firstRow?.querySelectorAll("td")[2];
    expect(goodCell).toBeInTheDocument();

    goodCell?.focus();
    await user.keyboard(" "); // Press space

    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  test("submits the form with selected values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { container } = render(
      <MatrixQuestion
        {...defaultProps}
        onSubmit={onSubmit}
        value={{ "Service 1": "Good", "Service 2": "Excellent" }}
      />
    );

    // Find the form element and submit it directly
    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();

    // Use fireEvent instead of userEvent for form submission
    await user.click(screen.getByText("Next"));
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onSubmit).toHaveBeenCalledWith(
      { "matrix-q1": { "Service 1": "Good", "Service 2": "Excellent" } },
      {}
    );
  });

  test("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<MatrixQuestion {...defaultProps} onBack={onBack} />);

    const backButton = screen.getByText("Back");
    await user.click(backButton);

    expect(onBack).toHaveBeenCalled();
  });

  test("renders media when available", () => {
    const question = {
      ...defaultProps.question,
      imageUrl: "https://example.com/image.jpg",
    } as unknown as TSurveyMatrixQuestion;

    render(<MatrixQuestion {...defaultProps} question={question} />);

    // QuestionMedia component should be rendered
    const questionMediaContainer = document.querySelector("img");
    expect(questionMediaContainer).toBeInTheDocument();
  });

  test("shuffles rows when shuffleOption is not 'none'", () => {
    const question = {
      ...defaultProps.question,
      shuffleOption: "all",
    } as unknown as TSurveyMatrixQuestion;

    render(<MatrixQuestion {...defaultProps} question={question} />);

    expect(getShuffledRowIndices).toHaveBeenCalled();
  });

  test("initializes empty values correctly when selecting first option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MatrixQuestion {...defaultProps} value={{}} onChange={onChange} />);

    // Find the first row and its first cell
    const firstRow = screen.getByText("Service 1").closest("tr");
    const firstCell = firstRow?.querySelector("td:first-of-type");
    expect(firstCell).toBeInTheDocument();

    await user.click(firstCell!);

    expect(onChange).toHaveBeenCalled();
    const expectedValue = expect.objectContaining({
      "matrix-q1": expect.any(Object),
    });
    expect(onChange).toHaveBeenCalledWith(expectedValue);
  });
});
