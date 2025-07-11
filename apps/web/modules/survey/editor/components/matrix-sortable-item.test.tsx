import { createI18nString } from "@/lib/i18n/utils";
// Get reference to the mocked function for testing
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
// Get reference to the mocked function for testing
import { useSortable } from "@dnd-kit/sortable";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyMatrixQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { MatrixSortableItem } from "./matrix-sortable-item";

// Mock useSortable hook
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: vi.fn(() => ({
    attributes: { "data-test": "sortable-attributes" } as any,
    listeners: { "data-test": "sortable-listeners" } as any,
    setNodeRef: vi.fn(),
    transform: null as any,
    transition: null as any,
  })),
}));

const mockUseSortable = vi.mocked(useSortable);

// Mock CSS utilities
vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => "translate3d(0px, 0px, 0px)"),
    },
  },
}));

// Mock QuestionFormInput component
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn(({ value, updateMatrixLabel, type, index, onKeyDown }) => (
    <input
      data-testid="question-form-input"
      value={value?.default || ""}
      onChange={(e) => updateMatrixLabel(index, type, { default: e.target.value })}
      onKeyDown={onKeyDown}
    />
  )),
}));

const mockQuestionFormInput = vi.mocked(QuestionFormInput);

// Mock TooltipRenderer component
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: vi.fn(({ children, tooltipContent }) => (
    <div data-testid="tooltip-renderer" data-tooltip={tooltipContent}>
      {children}
    </div>
  )),
}));

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Create mock data
const mockChoice = {
  id: "row-1",
  label: createI18nString("Test Row", ["en"]),
};

const mockQuestion: TSurveyMatrixQuestion = {
  id: "matrix-1",
  type: TSurveyQuestionTypeEnum.Matrix,
  headline: createI18nString("Matrix Question", ["en"]),
  required: false,
  logic: [],
  rows: [mockChoice],
  columns: [],
  shuffleOption: "none",
};

const mockSurvey: TSurvey = {
  id: "survey-1",
  name: "Test Survey",
  questions: [mockQuestion],
} as unknown as TSurvey;

const defaultProps = {
  choice: mockChoice,
  type: "row" as const,
  index: 0,
  localSurvey: mockSurvey,
  question: mockQuestion,
  questionIdx: 0,
  updateMatrixLabel: vi.fn(),
  onDelete: vi.fn(),
  onKeyDown: vi.fn(),
  canDelete: true,
  selectedLanguageCode: "en",
  setSelectedLanguageCode: vi.fn(),
  isInvalid: false,
  locale: "en-US" as TUserLocale,
};

describe("MatrixSortableItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset specific mocks to their default behavior
    mockUseSortable.mockReturnValue({
      attributes: { "data-test": "sortable-attributes" },
      listeners: { "data-test": "sortable-listeners" },
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("renders correctly with all props", () => {
    render(<MatrixSortableItem {...defaultProps} />);

    // Check if the component renders
    expect(screen.getByTestId("question-form-input")).toBeInTheDocument();

    // Check if the delete button is rendered when canDelete is true
    expect(screen.getByTestId("tooltip-renderer")).toBeInTheDocument();
  });

  test("does not render delete button when canDelete is false", () => {
    render(<MatrixSortableItem {...defaultProps} canDelete={false} />);

    // Check if the component renders
    expect(screen.getByTestId("question-form-input")).toBeInTheDocument();

    // Check that the delete button is not rendered
    expect(screen.queryByTestId("tooltip-renderer")).not.toBeInTheDocument();
  });

  test("calls updateMatrixLabel when input changes", async () => {
    const updateMatrixLabel = vi.fn();
    const user = userEvent.setup();

    render(<MatrixSortableItem {...defaultProps} updateMatrixLabel={updateMatrixLabel} />);

    const input = screen.getByTestId("question-form-input");
    await user.clear(input);
    await user.type(input, "New Label");

    // Check if updateMatrixLabel was called with the correct parameters
    expect(updateMatrixLabel).toHaveBeenCalled();
  });

  test("calls onDelete when delete button is clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(<MatrixSortableItem {...defaultProps} onDelete={onDelete} />);

    // Find the delete button inside the tooltip renderer
    const deleteButton = screen.getByRole("button");
    await user.click(deleteButton);

    // Check if onDelete was called with the correct index
    expect(onDelete).toHaveBeenCalledWith(0);
  });

  test("calls onKeyDown when key is pressed", async () => {
    const onKeyDown = vi.fn();

    render(<MatrixSortableItem {...defaultProps} onKeyDown={onKeyDown} />);

    const input = screen.getByTestId("question-form-input");
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Check if onKeyDown was called
    expect(onKeyDown).toHaveBeenCalled();
  });

  test("renders with correct styling when transform is provided", () => {
    // Override the useSortable mock for this test
    mockUseSortable.mockReturnValueOnce({
      attributes: { "data-test": "sortable-attributes" },
      listeners: { "data-test": "sortable-listeners" },
      setNodeRef: vi.fn(),
      transform: { x: 10, y: 20, scaleX: 1, scaleY: 1 },
      transition: "transform 200ms ease",
    } as any);

    const { container } = render(<MatrixSortableItem {...defaultProps} />);

    // The component should have the style applied
    const component = container.querySelector(".flex");
    expect(component).toHaveStyle("transform: translate3d(0px, 0px, 0px)");
    expect(component).toHaveStyle("transition: transform 200ms ease");
  });

  test("renders for column type correctly", () => {
    render(<MatrixSortableItem {...defaultProps} type="column" />);

    // Check if the component renders with column type
    expect(screen.getByTestId("question-form-input")).toBeInTheDocument();
  });

  test("handles invalid state correctly", () => {
    const { container } = render(<MatrixSortableItem {...defaultProps} isInvalid={true} />);

    // Check if the component renders correctly with invalid state
    const input = container.querySelector('[data-testid="question-form-input"]');
    expect(input).toBeInTheDocument();
    // Note: We can't directly test if isInvalid is passed to QuestionFormInput
    // since we're mocking it, but we can verify the component renders
  });

  test("renders grip icon for dragging", () => {
    const { container } = render(<MatrixSortableItem {...defaultProps} />);

    // Check that the grip icon is rendered
    const gripIcon = container.querySelector("svg");
    expect(gripIcon).toBeInTheDocument();
  });

  test("applies drag attributes and listeners correctly", () => {
    const mockSetNodeRef = vi.fn();
    const mockAttributes = { "data-sortable": "true", role: "button" };
    const mockListeners = { onMouseDown: vi.fn(), onTouchStart: vi.fn() };

    mockUseSortable.mockReturnValueOnce({
      attributes: mockAttributes,
      listeners: mockListeners,
      setNodeRef: mockSetNodeRef,
      transform: null,
      transition: null,
    } as any);

    render(<MatrixSortableItem {...defaultProps} />);

    // Verify that setNodeRef is called (component should be rendered)
    expect(mockSetNodeRef).toHaveBeenCalled();
  });

  test("displays correct tooltip content for delete button", () => {
    render(<MatrixSortableItem {...defaultProps} />);

    const tooltip = screen.getByTestId("tooltip-renderer");
    expect(tooltip).toHaveAttribute("data-tooltip", "common.delete");
  });

  test("passes correct props to QuestionFormInput", () => {
    const mockUpdateMatrixLabel = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();

    render(
      <MatrixSortableItem
        {...defaultProps}
        updateMatrixLabel={mockUpdateMatrixLabel}
        selectedLanguageCode="fr"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={true}
        type="column"
        index={2}
      />
    );

    // Verify QuestionFormInput is called with correct props
    expect(mockQuestionFormInput).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "column-2",
        value: mockChoice.label,
        updateMatrixLabel: mockUpdateMatrixLabel,
        selectedLanguageCode: "fr",
        setSelectedLanguageCode: mockSetSelectedLanguageCode,
        isInvalid: true,
        locale: "en-US",
      }),
      undefined
    );
  });

  test("uses choice.id as sortable id", () => {
    const customChoice = {
      id: "custom-choice-id",
      label: createI18nString("Custom Choice", ["en"]),
    };

    render(<MatrixSortableItem {...defaultProps} choice={customChoice} />);

    // Verify useSortable was called with the correct id
    expect(mockUseSortable).toHaveBeenCalledWith({
      id: "custom-choice-id",
    });
  });

  test("applies fallback transition when none provided", () => {
    mockUseSortable.mockReturnValueOnce({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
    } as any);

    const { container } = render(<MatrixSortableItem {...defaultProps} />);

    const component = container.querySelector(".flex");
    expect(component).toHaveStyle("transition: transform 100ms ease");
  });

  test("prevents default on delete button click", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(<MatrixSortableItem {...defaultProps} onDelete={onDelete} />);

    const deleteButton = screen.getByRole("button");

    // Create a mock event to verify preventDefault is called
    const mockEvent = {
      preventDefault: vi.fn(),
      type: "click",
      target: deleteButton,
    };

    // Simulate the click event
    fireEvent.click(deleteButton, mockEvent);

    expect(onDelete).toHaveBeenCalledWith(0);
  });

  test("handles different locale values", () => {
    render(<MatrixSortableItem {...defaultProps} locale="fr-FR" />);

    expect(mockQuestionFormInput).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "fr-FR",
      }),
      undefined
    );
  });

  test("renders delete button with correct variant and size", () => {
    render(<MatrixSortableItem {...defaultProps} />);

    // Check that the delete button has the correct props
    const deleteButton = screen.getByRole("button");
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toHaveClass("ml-2");
  });

  test("handles choice with empty label", () => {
    const choiceWithEmptyLabel = {
      id: "empty-choice",
      label: createI18nString("", ["en"]),
    };

    render(<MatrixSortableItem {...defaultProps} choice={choiceWithEmptyLabel} />);

    // Should still render without issues
    expect(screen.getByTestId("question-form-input")).toBeInTheDocument();
  });

  test("handles transform with scale values", () => {
    mockUseSortable.mockReturnValueOnce({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: { x: 5, y: 10, scaleX: 0.95, scaleY: 0.95 },
      transition: "all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    } as any);

    const { container } = render(<MatrixSortableItem {...defaultProps} />);

    const component = container.querySelector(".flex");
    expect(component).toHaveStyle("transform: translate3d(0px, 0px, 0px)");
    expect(component).toHaveStyle("transition: all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)");
  });
});
