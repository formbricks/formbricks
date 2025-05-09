import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  type TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { PictureSelectionQuestion } from "./picture-selection-question";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value) => (typeof value === "string" ? value : value.default)),
}));

vi.mock("@/lib/storage", () => ({
  getOriginalFileNameFromUrl: vi.fn(() => "test-image"),
}));

vi.mock("@/lib/ttc", () => ({
  getUpdatedTtc: vi.fn((ttc) => ttc),
  useTtc: vi.fn(),
}));

describe("PictureSelectionQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockQuestion: TSurveyPictureSelectionQuestion = {
    id: "q1",
    type: TSurveyQuestionTypeEnum.PictureSelection,
    headline: { default: "Select an image" },
    required: true,
    allowMulti: false,
    choices: [
      { id: "c1", imageUrl: "https://example.com/image1.jpg" },
      { id: "c2", imageUrl: "https://example.com/image2.jpg" },
    ],
    buttonLabel: { default: "Next" },
    backButtonLabel: { default: "Back" },
  };

  const mockProps = {
    question: mockQuestion,
    value: [],
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {},
    setTtc: vi.fn(),
    autoFocusEnabled: true,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  test("renders the component correctly", () => {
    render(<PictureSelectionQuestion {...mockProps} />);

    // Check for images and buttons which are clearly visible in the DOM
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  test("renders media content when available", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "https://example.com/question-image.jpg",
    };

    render(<PictureSelectionQuestion {...mockProps} question={questionWithMedia} />);

    // Check for the QuestionMedia component (additional img would be present)
    expect(screen.getAllByRole("img").length).toBeGreaterThan(2);
  });

  test("handles single selection correctly", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // Render with custom onChange to track calls more precisely
    render(<PictureSelectionQuestion {...mockProps} onChange={onChange} />);

    const images = screen.getAllByRole("img");

    // First click should select the item
    await user.click(images[0]);
    expect(onChange).toHaveBeenLastCalledWith({ q1: ["c1"] });

    // Reset the mock to clearly see the next call
    onChange.mockClear();

    // Re-render with the updated value to reflect the current state
    cleanup();
    render(<PictureSelectionQuestion {...mockProps} value={["c1"]} onChange={onChange} />);

    // Click the same image again - should now deselect
    const updatedImages = screen.getAllByRole("img");
    await user.click(updatedImages[0]);
    expect(onChange).toHaveBeenCalledWith({ q1: [] });
  });

  test("handles multiple selection when allowMulti is true", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const multiQuestion = { ...mockQuestion, allowMulti: true };

    render(<PictureSelectionQuestion {...mockProps} question={multiQuestion} onChange={onChange} />);

    const images = screen.getAllByRole("img");

    // First click selects the first item
    await user.click(images[0]);
    expect(onChange).toHaveBeenLastCalledWith({ q1: ["c1"] });

    // Now we need to re-render with the updated value to simulate state update
    onChange.mockClear();
    cleanup();

    render(
      <PictureSelectionQuestion {...mockProps} question={multiQuestion} onChange={onChange} value={["c1"]} />
    );

    // Click the second image to add it to selection
    const updatedImages = screen.getAllByRole("img");
    await user.click(updatedImages[1]);

    // Now it should add c2 to the existing array with c1
    expect(onChange).toHaveBeenCalledWith({ q1: ["c1", "c2"] });
  });

  test("handles form submission", async () => {
    const user = userEvent.setup();
    const mockValue = ["c1"];
    const mockTtc = { q1: 1000 };

    render(<PictureSelectionQuestion {...mockProps} value={mockValue} ttc={mockTtc} />);

    const submitButton = screen.getByText("Next");
    await user.click(submitButton);

    expect(mockProps.onSubmit).toHaveBeenCalledWith({ q1: ["c1"] }, mockTtc);
  });

  test("handles back button click", async () => {
    const user = userEvent.setup();

    render(<PictureSelectionQuestion {...mockProps} />);

    const backButton = screen.getByText("Back");
    await user.click(backButton);

    expect(mockProps.onBack).toHaveBeenCalled();
  });

  test("doesn't render back button when isFirstQuestion or isBackButtonHidden is true", () => {
    render(<PictureSelectionQuestion {...mockProps} isFirstQuestion={true} />);
    expect(screen.queryByText("Back")).not.toBeInTheDocument();

    cleanup();

    render(<PictureSelectionQuestion {...mockProps} isBackButtonHidden={true} />);
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("handles keyboard navigation with Space key", () => {
    render(<PictureSelectionQuestion {...mockProps} />);

    const images = screen.getAllByRole("img");
    const label = images[0].closest("label");

    fireEvent.keyDown(label!, { key: " " });

    expect(mockProps.onChange).toHaveBeenCalledWith({ q1: ["c1"] });
  });

  test("renders checkboxes when allowMulti is true", () => {
    const multiQuestion = { ...mockQuestion, allowMulti: true };

    render(<PictureSelectionQuestion {...mockProps} question={multiQuestion} value={["c1"]} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  test("renders radio buttons when allowMulti is false", () => {
    render(<PictureSelectionQuestion {...mockProps} value={["c1"]} />);

    const radioButtons = screen.getAllByRole("radio");
    expect(radioButtons).toHaveLength(2);
    expect(radioButtons[0]).toBeChecked();
    expect(radioButtons[1]).not.toBeChecked();
  });

  test("prevents default action when clicking image expand link", async () => {
    render(<PictureSelectionQuestion {...mockProps} />);

    const links = screen.getAllByTitle("Open in new tab");
    const mockStopPropagation = vi.fn();

    // Simulate clicking the link but prevent the event from propagating
    fireEvent.click(links[0], { stopPropagation: mockStopPropagation });

    // The onChange should not be called because stopPropagation prevents it
    expect(mockProps.onChange).not.toHaveBeenCalled();
  });
});
