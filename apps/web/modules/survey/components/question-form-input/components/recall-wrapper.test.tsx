import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import * as recallUtils from "@/lib/utils/recall";
import { RecallItemSelect } from "@/modules/survey/components/question-form-input/components/recall-item-select";
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

// Mock structuredClone if it's not available
global.structuredClone = global.structuredClone || ((obj: any) => JSON.parse(JSON.stringify(obj)));

vi.mock("@/modules/survey/components/question-form-input/components/fallback-input", () => ({
  FallbackInput: vi
    .fn()
    .mockImplementation(({ addFallback, open, filteredRecallItems, fallbacks, setFallbacks }) =>
      open ? (
        <div data-testid="fallback-input">
          {filteredRecallItems.map((item: any) => (
            <input
              key={item.id}
              data-testid={`fallback-input-${item.id}`}
              placeholder={`Fallback for ${item.label}`}
              value={fallbacks[item.id] || ""}
              onChange={(e) => setFallbacks({ ...fallbacks, [item.id]: e.target.value })}
            />
          ))}
          <button type="button" data-testid="add-fallback-btn" onClick={addFallback}>
            Add Fallback
          </button>
        </div>
      ) : null
    ),
}));

vi.mock("@/modules/survey/components/question-form-input/components/recall-item-select", () => ({
  RecallItemSelect: vi
    .fn()
    .mockImplementation(() => <div data-testid="recall-item-select">Recall Item Select</div>),
}));

describe("RecallWrapper", () => {
  const defaultProps = {
    value: "Test value",
    onChange: vi.fn(),
    localSurvey: {
      id: "testSurveyId",
      questions: [],
      hiddenFields: { enabled: false },
    } as unknown as TSurvey,
    questionId: "testQuestionId",
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

  afterEach(() => {
    cleanup();
  });

  // Ensure headlineToRecall always returns a string, even with null input
  beforeEach(() => {
    vi.mocked(recallUtils.headlineToRecall).mockImplementation((val) => val || "");
    vi.mocked(recallUtils.recallToHeadline).mockImplementation((val) => val || { en: "" });
    // Reset all mocks to default state
    vi.mocked(recallUtils.getRecallItems).mockReturnValue([]);
    vi.mocked(recallUtils.findRecallInfoById).mockReturnValue(null);
  });

  test("renders correctly with no recall items", () => {
    render(<RecallWrapper {...defaultProps} />);

    expect(screen.getByTestId("test-input")).toBeInTheDocument();
    expect(screen.getByTestId("rendered-text")).toBeInTheDocument();
  });

  test("renders correctly with recall items", () => {
    const recallItems = [{ id: "testRecallId", label: "testLabel", type: "question" }] as TSurveyRecallItem[];
    vi.mocked(recallUtils.getRecallItems).mockReturnValue(recallItems);

    render(<RecallWrapper {...defaultProps} value="Test with #recall:testRecallId/fallback:# inside" />);

    expect(screen.getByTestId("test-input")).toBeInTheDocument();
    expect(screen.getByTestId("rendered-text")).toBeInTheDocument();
  });

  test("shows recall item select when @ is typed", async () => {
    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, "@");

    expect(screen.getByTestId("recall-select-visible").textContent).toBe("true");
  });

  test("adds recall item when selected", async () => {
    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, "@");

    expect(RecallItemSelect).toHaveBeenCalled();
  });

  test("detects recall items when value contains recall syntax", () => {
    const valueWithRecall = "Test with #recall:testId/fallback:# inside";
    const recallItems = [{ id: "testId", label: "testLabel", type: "question" }] as TSurveyRecallItem[];

    vi.mocked(recallUtils.getRecallItems).mockReturnValue(recallItems);

    render(<RecallWrapper {...defaultProps} value={valueWithRecall} />);

    // Verify that recall items are detected
    expect(recallUtils.getRecallItems).toHaveBeenCalledWith(valueWithRecall, expect.any(Object), "en");
  });

  test("displays error when trying to add empty recall item", async () => {
    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, "@");

    const mockedRecallItemSelect = vi.mocked(RecallItemSelect);
    const addRecallItemFunction = mockedRecallItemSelect.mock.calls[0][0].addRecallItem;

    // Add an item with empty label
    addRecallItemFunction({ id: "testRecallId", label: "", type: "question" });

    expect(toast.error).toHaveBeenCalledWith("Recall item label cannot be empty");
  });

  test("handles input changes correctly", async () => {
    render(<RecallWrapper {...defaultProps} />);

    const input = screen.getByTestId("test-input");
    await userEvent.type(input, "New text");

    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  test("updates internal value when props value changes", () => {
    const { rerender } = render(<RecallWrapper {...defaultProps} value="Initial value" />);

    rerender(<RecallWrapper {...defaultProps} value="Updated value" />);

    expect(screen.getByTestId("test-input")).toHaveValue("Updated value");
  });

  test("handles recall disable", () => {
    render(<RecallWrapper {...defaultProps} isRecallAllowed={false} />);

    const input = screen.getByTestId("test-input");
    fireEvent.change(input, { target: { value: "test@" } });

    expect(screen.getByTestId("recall-select-visible").textContent).toBe("false");
  });

  test("renders recall items when value contains recall syntax", () => {
    const valueWithRecall = "Test with #recall:testId/fallback:# inside";
    const recallItems = [{ id: "testId", label: "testLabel", type: "question" }] as TSurveyRecallItem[];

    vi.mocked(recallUtils.getRecallItems).mockReturnValue(recallItems);

    render(<RecallWrapper {...defaultProps} value={valueWithRecall} />);

    // Verify that recall items are detected and rendered
    expect(recallUtils.getRecallItems).toHaveBeenCalledWith(valueWithRecall, expect.any(Object), "en");
  });

  test("handles recall item state changes", () => {
    const valueWithRecall = "Test with #recall:testId/fallback:# inside";
    const recallItems = [{ id: "testId", label: "testLabel", type: "question" }] as TSurveyRecallItem[];

    vi.mocked(recallUtils.getRecallItems).mockReturnValue(recallItems);

    render(<RecallWrapper {...defaultProps} value={valueWithRecall} />);

    // Verify that recall items are detected
    expect(recallUtils.getRecallItems).toHaveBeenCalledWith(valueWithRecall, expect.any(Object), "en");
  });
});
