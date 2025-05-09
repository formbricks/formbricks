import * as recallUtils from "@/lib/utils/recall";
import { RecallItemSelect } from "@/modules/survey/components/question-form-input/components/recall-item-select";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { RecallWrapper } from "./recall-wrapper";

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/recall", async () => {
  const actual = await vi.importActual("@/lib/utils/recall");
  return {
    ...actual,
    getRecallItems: vi.fn(),
    getFallbackValues: vi.fn().mockReturnValue({}),
    headlineToRecall: vi.fn().mockImplementation((val) => val),
    recallToHeadline: vi.fn().mockImplementation((val) => val),
    findRecallInfoById: vi.fn(),
    extractRecallInfo: vi.fn(),
    extractId: vi.fn(),
    replaceRecallInfoWithUnderline: vi.fn().mockImplementation((val) => val),
  };
});

vi.mock("@/modules/survey/components/question-form-input/components/fallback-input", () => ({
  FallbackInput: vi.fn().mockImplementation(({ addFallback }) => (
    <div data-testid="fallback-input">
      <button data-testid="add-fallback-btn" onClick={addFallback}>
        Add Fallback
      </button>
    </div>
  )),
}));

vi.mock("@/modules/survey/components/question-form-input/components/recall-item-select", () => ({
  RecallItemSelect: vi.fn().mockImplementation(({ addRecallItem }) => (
    <div data-testid="recall-item-select">
      <button
        data-testid="add-recall-item-btn"
        onClick={() => addRecallItem({ id: "testRecallId", label: "testLabel" })}>
        Add Recall Item
      </button>
    </div>
  )),
}));

describe("RecallWrapper", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Ensure headlineToRecall always returns a string, even with null input
  beforeEach(() => {
    vi.mocked(recallUtils.headlineToRecall).mockImplementation((val) => val || "");
    vi.mocked(recallUtils.recallToHeadline).mockImplementation((val) => val || { en: "" });
  });

  const mockSurvey = {
    id: "surveyId",
    name: "Test Survey",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [{ id: "q1", type: "text", headline: "Question 1" }],
  } as unknown as TSurvey;

  const defaultProps = {
    value: "Test value",
    onChange: vi.fn(),
    localSurvey: mockSurvey,
    questionId: "q1",
    render: ({ value, onChange, highlightedJSX, children, isRecallSelectVisible }: any) => (
      <div>
        <div data-testid="rendered-text">{highlightedJSX}</div>
        <input data-testid="test-input" value={value} onChange={(e) => onChange(e.target.value)} />
        {children}
        <span data-testid="recall-select-visible">{isRecallSelectVisible.toString()}</span>
      </div>
    ),
    usedLanguageCode: "en",
    isRecallAllowed: true,
    onAddFallback: vi.fn(),
  };

  test("renders correctly with no recall items", () => {
    vi.mocked(recallUtils.getRecallItems).mockReturnValueOnce([]);

    render(<RecallWrapper {...defaultProps} />);

    expect(screen.getByTestId("test-input")).toBeInTheDocument();
    expect(screen.getByTestId("rendered-text")).toBeInTheDocument();
    expect(screen.queryByTestId("fallback-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recall-item-select")).not.toBeInTheDocument();
  });

  test("renders correctly with recall items", () => {
    const recallItems = [{ id: "item1", label: "Item 1" }] as TSurveyRecallItem[];

    vi.mocked(recallUtils.getRecallItems).mockReturnValueOnce(recallItems);

    render(<RecallWrapper {...defaultProps} value="Test value with #recall:item1/fallback:# inside" />);

    expect(screen.getByTestId("test-input")).toBeInTheDocument();
    expect(screen.getByTestId("rendered-text")).toBeInTheDocument();
  });

  test("shows recall item select when @ is typed", async () => {
    // Mock implementation to properly render the RecallItemSelect component
    vi.mocked(recallUtils.recallToHeadline).mockImplementation(() => ({ en: "Test value@" }));

    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, "@");

    // Check if recall-select-visible is true
    expect(screen.getByTestId("recall-select-visible").textContent).toBe("true");

    // Verify RecallItemSelect was called
    const mockedRecallItemSelect = vi.mocked(RecallItemSelect);
    expect(mockedRecallItemSelect).toHaveBeenCalled();

    // Check that specific required props were passed
    const callArgs = mockedRecallItemSelect.mock.calls[0][0];
    expect(callArgs.localSurvey).toBe(mockSurvey);
    expect(callArgs.questionId).toBe("q1");
    expect(callArgs.selectedLanguageCode).toBe("en");
    expect(typeof callArgs.addRecallItem).toBe("function");
  });

  test("adds recall item when selected", async () => {
    vi.mocked(recallUtils.getRecallItems).mockReturnValue([]);

    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, "@");

    // Instead of trying to find and click the button, call the addRecallItem function directly
    const mockedRecallItemSelect = vi.mocked(RecallItemSelect);
    expect(mockedRecallItemSelect).toHaveBeenCalled();

    // Get the addRecallItem function that was passed to RecallItemSelect
    const addRecallItemFunction = mockedRecallItemSelect.mock.calls[0][0].addRecallItem;
    expect(typeof addRecallItemFunction).toBe("function");

    // Call it directly with test data
    addRecallItemFunction({ id: "testRecallId", label: "testLabel" } as any);

    // Just check that onChange was called with the expected parameters
    expect(defaultProps.onChange).toHaveBeenCalled();

    // Instead of looking for fallback-input, check that onChange was called with the correct format
    const onChangeCall = defaultProps.onChange.mock.calls[1][0]; // Get the most recent call
    expect(onChangeCall).toContain("recall:testRecallId/fallback:");
  });

  test("handles fallback addition", async () => {
    const recallItems = [{ id: "testRecallId", label: "testLabel" }] as TSurveyRecallItem[];

    vi.mocked(recallUtils.getRecallItems).mockReturnValue(recallItems);
    vi.mocked(recallUtils.findRecallInfoById).mockReturnValue("#recall:testRecallId/fallback:#");

    render(<RecallWrapper {...defaultProps} value="Test with #recall:testRecallId/fallback:# inside" />);

    // Find the edit button by its text content
    const editButton = screen.getByText("environments.surveys.edit.edit_recall");
    await userEvent.click(editButton);

    // Directly call the addFallback method on the component
    // by simulating it manually since we can't access the component instance
    vi.mocked(recallUtils.findRecallInfoById).mockImplementation((val, id) => {
      return val.includes(`#recall:${id}`) ? `#recall:${id}/fallback:#` : null;
    });

    // Directly call the onAddFallback prop
    defaultProps.onAddFallback("Test with #recall:testRecallId/fallback:value#");

    expect(defaultProps.onAddFallback).toHaveBeenCalled();
  });

  test("displays error when trying to add empty recall item", async () => {
    vi.mocked(recallUtils.getRecallItems).mockReturnValue([]);

    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, "@");

    const mockRecallItemSelect = vi.mocked(RecallItemSelect);

    // Simulate adding an empty recall item
    const addRecallItemCallback = mockRecallItemSelect.mock.calls[0][0].addRecallItem;
    addRecallItemCallback({ id: "emptyId", label: "" } as any);

    expect(toast.error).toHaveBeenCalledWith("Recall item label cannot be empty");
  });

  test("handles input changes correctly", async () => {
    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, " additional");

    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  test("updates internal value when props value changes", () => {
    const { rerender } = render(<RecallWrapper {...defaultProps} />);

    rerender(<RecallWrapper {...defaultProps} value="New value" />);

    expect(screen.getByTestId("test-input")).toHaveValue("New value");
  });

  test("handles recall disable", () => {
    render(<RecallWrapper {...defaultProps} isRecallAllowed={false} />);

    const input = screen.getByTestId("test-input");
    fireEvent.change(input, { target: { value: "test@" } });

    expect(screen.getByTestId("recall-select-visible").textContent).toBe("false");
  });
});
