import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getSurveyFilterDataAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { generateQuestionAndFilterOptions } from "@/app/lib/surveys/surveys";
import { getSurveyFilterDataBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
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

vi.mock("@/app/share/[sharingKey]/actions", () => ({
  getSurveyFilterDataBySurveySharingKeyAction: vi.fn(),
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
    onlyComplete: false,
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
    expect(screen.getByText("environments.surveys.summary.only_completed")).toBeInTheDocument();
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
      selectedFilter: { filter: [], onlyComplete: false },
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

  test("handles only complete checkbox toggle", async () => {
    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByText("common.apply_filters"));

    expect(mockSetSelectedFilter).toHaveBeenCalledWith({ filter: [], onlyComplete: true });
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
        onlyComplete: false,
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

    expect(mockSetSelectedFilter).toHaveBeenCalledWith({ filter: [], onlyComplete: false });
  });

  test("uses sharing key action when on sharing page", async () => {
    vi.mocked(useParams).mockReturnValue({
      environmentId: "env1",
      surveyId: "survey1",
      sharingKey: "share123",
    });
    vi.mocked(getSurveyFilterDataBySurveySharingKeyAction).mockResolvedValue({
      data: {
        attributes: [],
        meta: {},
        environmentTags: [],
        hiddenFields: [],
      } as any,
    });

    render(<ResponseFilter survey={mockSurvey} />);

    await userEvent.click(screen.getByText("Filter"));

    expect(getSurveyFilterDataBySurveySharingKeyAction).toHaveBeenCalledWith({
      sharingKey: "share123",
      environmentId: "env1",
    });
  });
});
