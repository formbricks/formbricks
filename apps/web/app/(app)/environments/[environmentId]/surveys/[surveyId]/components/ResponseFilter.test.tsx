import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getSurveyFilterDataAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { generateQuestionAndFilterOptions } from "@/app/lib/surveys/surveys";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { ResponseFilter } from "./ResponseFilter";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: vi.fn(),
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions", () => ({
  getSurveyFilterDataAction: vi.fn(),
}));

vi.mock("@/app/lib/surveys/surveys", () => ({
  generateQuestionAndFilterOptions: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [[vi.fn()]],
}));

// Mock the Select components
const mockOnValueChange = vi.fn();
vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, onValueChange, defaultValue }) => {
    // Store the onValueChange callback for testing
    mockOnValueChange.mockImplementation(onValueChange);
    return (
      <div data-testid="select-root" data-default-value={defaultValue}>
        {children}
      </div>
    );
  },
  SelectTrigger: ({ children, className }) => (
    <div
      role="combobox"
      className={className}
      data-testid="select-trigger"
      tabIndex={0}
      aria-expanded="false"
      aria-haspopup="listbox">
      {children}
    </div>
  ),
  SelectValue: () => <span>environments.surveys.filter.complete_and_partial_responses</span>,
  SelectContent: ({ children }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ value, children, ...props }) => (
    <div
      data-testid={`select-item-${value}`}
      data-value={value}
      onClick={() => mockOnValueChange(value)}
      onKeyDown={(e) => e.key === "Enter" && mockOnValueChange(value)}
      role="option"
      tabIndex={0}
      {...props}>
      {children}
    </div>
  ),
}));

vi.mock("./QuestionsComboBox", () => ({
  QuestionsComboBox: ({ onChangeValue }) => (
    <div data-testid="questions-combo-box">
      <button onClick={() => onChangeValue({ id: "q1", label: "Question 1", type: "OpenText" })}>
        Select Question
      </button>
    </div>
  ),
  OptionsType: {
    QUESTIONS: "Questions",
    ATTRIBUTES: "Attributes",
    TAGS: "Tags",
    LANGUAGES: "Languages",
  },
}));

// Update the mock for QuestionFilterComboBox to always render
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionFilterComboBox",
  () => ({
    QuestionFilterComboBox: () => (
      <div data-testid="filter-combo-box">
        <button data-testid="select-filter-btn">Select Filter</button>
        <button data-testid="select-filter-type-btn">Select Filter Type</button>
      </div>
    ),
  })
);

describe("ResponseFilter", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockSelectedFilter = {
    filter: [],
    responseStatus: "all",
  };

  const mockSelectedOptions = {
    questionFilterOptions: [
      {
        type: TSurveyQuestionTypeEnum.OpenText,
        filterOptions: ["equals", "does not equal"],
        filterComboBoxOptions: [],
        id: "q1",
      },
    ],
    questionOptions: [
      {
        label: "Questions",
        type: "Questions",
        option: [
          { id: "q1", label: "Question 1", type: "OpenText", questionType: TSurveyQuestionTypeEnum.OpenText },
        ],
      },
    ],
  } as any;

  const mockSetSelectedFilter = vi.fn();
  const mockSetSelectedOptions = vi.fn();

  const mockSurvey = {
    id: "survey1",
    environmentId: "env1",
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    createdBy: "user1",
    questions: [],
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    triggers: [],
    displayOption: "displayOnce",
  } as unknown as TSurvey;

  beforeEach(() => {
    vi.mocked(useResponseFilter).mockReturnValue({
      selectedFilter: mockSelectedFilter,
      setSelectedFilter: mockSetSelectedFilter,
      selectedOptions: mockSelectedOptions,
      setSelectedOptions: mockSetSelectedOptions,
    } as any);

    vi.mocked(useParams).mockReturnValue({ environmentId: "env1", surveyId: "survey1" });

    vi.mocked(getSurveyFilterDataAction).mockResolvedValue({
      data: {
        attributes: [],
        meta: {},
        environmentTags: [],
        hiddenFields: [],
      } as any,
    });

    vi.mocked(generateQuestionAndFilterOptions).mockReturnValue({
      questionFilterOptions: mockSelectedOptions.questionFilterOptions,
      questionOptions: mockSelectedOptions.questionOptions,
    });
  });

  test("renders with default state", () => {
    render(<ResponseFilter survey={mockSurvey} />);
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  test("opens the filter popover when clicked", async () => {
    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));

    expect(
      screen.getByText("environments.surveys.summary.show_all_responses_that_match")
    ).toBeInTheDocument();
    expect(screen.getByTestId("select-trigger")).toBeInTheDocument();
  });

  test("fetches filter data when opened", async () => {
    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));

    expect(getSurveyFilterDataAction).toHaveBeenCalledWith({ surveyId: "survey1" });
    expect(mockSetSelectedOptions).toHaveBeenCalled();
  });

  test("handles adding new filter", async () => {
    // Start with an empty filter
    vi.mocked(useResponseFilter).mockReturnValue({
      selectedFilter: { filter: [], responseStatus: "all" },
      setSelectedFilter: mockSetSelectedFilter,
      selectedOptions: mockSelectedOptions,
      setSelectedOptions: mockSetSelectedOptions,
    } as any);

    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));
    // Verify there's no filter yet
    expect(screen.queryByTestId("questions-combo-box")).not.toBeInTheDocument();

    // Add a new filter and check that the questions combo box appears
    await userEvent.click(screen.getByText("common.add_filter"));

    expect(screen.getByTestId("questions-combo-box")).toBeInTheDocument();
  });

  test("handles response status filter change to complete", async () => {
    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));

    // Simulate selecting "complete" by calling the mock function
    mockOnValueChange("complete");

    await userEvent.click(screen.getByText("common.apply_filters"));

    expect(mockSetSelectedFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        responseStatus: "complete",
      })
    );
  });

  test("handles response status filter change to partial", async () => {
    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));

    // Simulate selecting "partial" by calling the mock function
    mockOnValueChange("partial");

    await userEvent.click(screen.getByText("common.apply_filters"));

    expect(mockSetSelectedFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        responseStatus: "partial",
      })
    );
  });

  test("handles selecting question and filter options", async () => {
    // Setup with a pre-populated filter to ensure the filter components are rendered
    const setSelectedFilterMock = vi.fn();
    vi.mocked(useResponseFilter).mockReturnValue({
      selectedFilter: {
        filter: [
          {
            questionType: { id: "q1", label: "Question 1", type: "OpenText" },
            filterType: { filterComboBoxValue: undefined, filterValue: undefined },
          },
        ],
        responseStatus: "all",
      },
      setSelectedFilter: setSelectedFilterMock,
      selectedOptions: mockSelectedOptions,
      setSelectedOptions: mockSetSelectedOptions,
    } as any);

    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));

    // Verify both combo boxes are rendered
    expect(screen.getByTestId("questions-combo-box")).toBeInTheDocument();
    expect(screen.getByTestId("filter-combo-box")).toBeInTheDocument();

    // Use data-testid to find our buttons instead of text
    await userEvent.click(screen.getByText("Select Question"));
    await userEvent.click(screen.getByTestId("select-filter-btn"));
    await userEvent.click(screen.getByText("common.apply_filters"));

    expect(setSelectedFilterMock).toHaveBeenCalled();
  });

  test("handles clear all filters", async () => {
    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));
    await userEvent.click(screen.getByText("common.clear_all"));

    expect(mockSetSelectedFilter).toHaveBeenCalledWith({ filter: [], responseStatus: "all" });
  });
});
