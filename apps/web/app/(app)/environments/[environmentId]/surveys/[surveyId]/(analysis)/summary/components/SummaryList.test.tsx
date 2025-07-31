import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { MultipleChoiceSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/MultipleChoiceSummary";
import { constructToastMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { OptionsType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionsComboBox";
import { cleanup, render, screen } from "@testing-library/react";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionTypeEnum,
  TSurveySummary,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SummaryList } from "./SummaryList";

// Mock child components
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys",
  () => ({
    EmptyAppSurveys: vi.fn(() => <div>Mocked EmptyAppSurveys</div>),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/CTASummary",
  () => ({
    CTASummary: vi.fn(({ questionSummary }) => <div>Mocked CTASummary: {questionSummary.question.id}</div>),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/CalSummary",
  () => ({
    CalSummary: vi.fn(({ questionSummary }) => <div>Mocked CalSummary: {questionSummary.question.id}</div>),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary",
  () => ({
    ConsentSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked ConsentSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ContactInfoSummary",
  () => ({
    ContactInfoSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked ContactInfoSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/DateQuestionSummary",
  () => ({
    DateQuestionSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked DateQuestionSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/FileUploadSummary",
  () => ({
    FileUploadSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked FileUploadSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/HiddenFieldsSummary",
  () => ({
    HiddenFieldsSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked HiddenFieldsSummary: {questionSummary.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/MatrixQuestionSummary",
  () => ({
    MatrixQuestionSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked MatrixQuestionSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/MultipleChoiceSummary",
  () => ({
    MultipleChoiceSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked MultipleChoiceSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/NPSSummary",
  () => ({
    NPSSummary: vi.fn(({ questionSummary }) => <div>Mocked NPSSummary: {questionSummary.question.id}</div>),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/OpenTextSummary",
  () => ({
    OpenTextSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked OpenTextSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/PictureChoiceSummary",
  () => ({
    PictureChoiceSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked PictureChoiceSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/RankingSummary",
  () => ({
    RankingSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked RankingSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/RatingSummary",
  () => ({
    RatingSummary: vi.fn(({ questionSummary }) => (
      <div>Mocked RatingSummary: {questionSummary.question.id}</div>
    )),
  })
);
vi.mock("./AddressSummary", () => ({
  AddressSummary: vi.fn(({ questionSummary }) => (
    <div>Mocked AddressSummary: {questionSummary.question.id}</div>
  )),
}));

// Mock hooks and utils
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: vi.fn(),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((label, _) => (typeof label === "string" ? label : label.default)),
}));
vi.mock("@/modules/ui/components/empty-space-filler", () => ({
  EmptySpaceFiller: vi.fn(() => <div>Mocked EmptySpaceFiller</div>),
}));
vi.mock("@/modules/ui/components/skeleton-loader", () => ({
  SkeletonLoader: vi.fn(() => <div>Mocked SkeletonLoader</div>),
}));
vi.mock("react-hot-toast", () => ({
  // This mock setup is for a named export 'toast'
  toast: {
    success: vi.fn(),
  },
}));
vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils", () => ({
  constructToastMessage: vi.fn(),
}));

const mockEnvironment = {
  id: "env_test_id",
  type: "production",
  createdAt: new Date(),
  updatedAt: new Date(),
  appSetupCompleted: true,
} as unknown as TEnvironment;

const mockSurvey = {
  id: "survey_test_id",
  name: "Test Survey",
  type: "app",
  environmentId: "env_test_id",
  status: "inProgress",
  questions: [],
  hiddenFields: { enabled: false },
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  languages: [],
  singleUse: null,
  styling: null,
  surveyClosedMessage: null,
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  recontactDays: null,
  autoComplete: null,
  runOnDate: null,
  segment: null,
  variables: [],
} as unknown as TSurvey;

const mockSelectedFilter = { filter: [], responseStatus: "all" };
const mockSetSelectedFilter = vi.fn();

const defaultProps = {
  summary: [] as TSurveySummary["summary"],
  responseCount: 10,
  environment: mockEnvironment,
  survey: mockSurvey,
  totalResponseCount: 20,
  locale: "en" as TUserLocale,
};

const createMockQuestionSummary = (
  id: string,
  type: TSurveyQuestionTypeEnum,
  headline: string = "Test Question"
) =>
  ({
    question: {
      id,
      headline: { default: headline, en: headline },
      type,
      required: false,
      choices:
        type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
        type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
          ? [{ id: "choice1", label: { default: "Choice 1" } }]
          : undefined,
      logic: [],
    },
    type,
    responseCount: 5,
    samples: type === TSurveyQuestionTypeEnum.OpenText ? [{ value: "sample" }] : [],
    choices:
      type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
      type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
        ? [{ label: { default: "Choice 1" }, count: 5, percentage: 1 }]
        : [],
    dismissed:
      type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
      type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
        ? { count: 0, percentage: 0 }
        : undefined,
    others:
      type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
      type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
        ? [{ value: "other", count: 0, percentage: 0 }]
        : [],
    progress: type === TSurveyQuestionTypeEnum.NPS ? { total: 5, trend: 0.5 } : undefined,
    average: type === TSurveyQuestionTypeEnum.Rating ? 3.5 : undefined,
    accepted: type === TSurveyQuestionTypeEnum.Consent ? { count: 5, percentage: 1 } : undefined,
    results:
      type === TSurveyQuestionTypeEnum.PictureSelection
        ? [{ imageUrl: "url", count: 5, percentage: 1 }]
        : undefined,
    files: type === TSurveyQuestionTypeEnum.FileUpload ? [{ url: "url", name: "file.pdf", size: 100 }] : [],
    booked: type === TSurveyQuestionTypeEnum.Cal ? { count: 5, percentage: 1 } : undefined,
    data: type === TSurveyQuestionTypeEnum.Matrix ? [{ rowLabel: "Row1", responses: {} }] : undefined,
    ranking: type === TSurveyQuestionTypeEnum.Ranking ? [{ rank: 1, choiceLabel: "Choice1", count: 5 }] : [],
  }) as unknown as TSurveySummary["summary"][number];

const createMockHiddenFieldSummary = (id: string, label: string = "Hidden Field") =>
  ({
    id,
    type: "hiddenField",
    label,
    value: "some value",
    count: 1,
    samples: [{ personId: "person1", value: "Sample Value", updatedAt: new Date().toISOString() }],
    responseCount: 1,
  }) as unknown as TSurveySummary["summary"][number];

const typeToComponentMockNameMap: Record<TSurveyQuestionTypeEnum, string> = {
  [TSurveyQuestionTypeEnum.OpenText]: "OpenTextSummary",
  [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: "MultipleChoiceSummary",
  [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: "MultipleChoiceSummary",
  [TSurveyQuestionTypeEnum.NPS]: "NPSSummary",
  [TSurveyQuestionTypeEnum.CTA]: "CTASummary",
  [TSurveyQuestionTypeEnum.Rating]: "RatingSummary",
  [TSurveyQuestionTypeEnum.Consent]: "ConsentSummary",
  [TSurveyQuestionTypeEnum.PictureSelection]: "PictureChoiceSummary",
  [TSurveyQuestionTypeEnum.Date]: "DateQuestionSummary",
  [TSurveyQuestionTypeEnum.FileUpload]: "FileUploadSummary",
  [TSurveyQuestionTypeEnum.Cal]: "CalSummary",
  [TSurveyQuestionTypeEnum.Matrix]: "MatrixQuestionSummary",
  [TSurveyQuestionTypeEnum.Address]: "AddressSummary",
  [TSurveyQuestionTypeEnum.Ranking]: "RankingSummary",
  [TSurveyQuestionTypeEnum.ContactInfo]: "ContactInfoSummary",
};

describe("SummaryList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(useResponseFilter).mockReturnValue({
      selectedFilter: mockSelectedFilter,
      setSelectedFilter: mockSetSelectedFilter,
      resetFilter: vi.fn(),
    } as any);
  });

  test("renders EmptyAppSurveys when survey type is app, responseCount is 0 and appSetupCompleted is false", () => {
    const testEnv = { ...mockEnvironment, appSetupCompleted: false };
    const testSurvey = { ...mockSurvey, type: "app" as const };
    render(<SummaryList {...defaultProps} survey={testSurvey} responseCount={0} environment={testEnv} />);
    expect(screen.getByText("Mocked EmptyAppSurveys")).toBeInTheDocument();
  });

  test("renders SkeletonLoader when summary is empty and responseCount is not 0", () => {
    render(<SummaryList {...defaultProps} summary={[]} responseCount={1} />);
    expect(screen.getByText("Mocked SkeletonLoader")).toBeInTheDocument();
  });

  test("renders EmptySpaceFiller when responseCount is 0 and summary is not empty (no responses match filter)", () => {
    const summaryWithItem = [createMockQuestionSummary("q1", TSurveyQuestionTypeEnum.OpenText)];
    render(<SummaryList {...defaultProps} summary={summaryWithItem} responseCount={0} />);
    expect(screen.getByText("Mocked EmptySpaceFiller")).toBeInTheDocument();
  });

  test("renders EmptySpaceFiller when responseCount is 0 and totalResponseCount is 0 (no responses at all)", () => {
    const summaryWithItem = [createMockQuestionSummary("q1", TSurveyQuestionTypeEnum.OpenText)];
    render(<SummaryList {...defaultProps} summary={summaryWithItem} responseCount={0} />);
    expect(screen.getByText("Mocked EmptySpaceFiller")).toBeInTheDocument();
  });

  const questionTypesToTest: TSurveyQuestionTypeEnum[] = [
    TSurveyQuestionTypeEnum.OpenText,
    TSurveyQuestionTypeEnum.MultipleChoiceSingle,
    TSurveyQuestionTypeEnum.MultipleChoiceMulti,
    TSurveyQuestionTypeEnum.NPS,
    TSurveyQuestionTypeEnum.CTA,
    TSurveyQuestionTypeEnum.Rating,
    TSurveyQuestionTypeEnum.Consent,
    TSurveyQuestionTypeEnum.PictureSelection,
    TSurveyQuestionTypeEnum.Date,
    TSurveyQuestionTypeEnum.FileUpload,
    TSurveyQuestionTypeEnum.Cal,
    TSurveyQuestionTypeEnum.Matrix,
    TSurveyQuestionTypeEnum.Address,
    TSurveyQuestionTypeEnum.Ranking,
    TSurveyQuestionTypeEnum.ContactInfo,
  ];

  questionTypesToTest.forEach((type) => {
    test(`renders ${type}Summary component`, () => {
      const mockSummaryItem = createMockQuestionSummary(`q_${type}`, type);
      const expectedComponentName = typeToComponentMockNameMap[type];
      render(<SummaryList {...defaultProps} summary={[mockSummaryItem]} />);
      expect(
        screen.getByText(new RegExp(`Mocked ${expectedComponentName}:\\s*q_${type}`))
      ).toBeInTheDocument();
    });
  });

  test("renders HiddenFieldsSummary component", () => {
    const mockSummaryItem = createMockHiddenFieldSummary("hf1");
    render(<SummaryList {...defaultProps} summary={[mockSummaryItem]} />);
    expect(screen.getByText("Mocked HiddenFieldsSummary: hf1")).toBeInTheDocument();
  });

  describe("setFilter function", () => {
    const questionId = "q_mc_single";
    const label: TI18nString = { default: "MC Single Question" };
    const questionType = TSurveyQuestionTypeEnum.MultipleChoiceSingle;
    const filterValue = "Choice 1";
    const filterComboBoxValue = "choice1_id";

    beforeEach(() => {
      // Render with a component that uses setFilter, e.g., MultipleChoiceSummary
      const mockSummaryItem = createMockQuestionSummary(questionId, questionType, label.default);
      render(<SummaryList {...defaultProps} summary={[mockSummaryItem]} />);
    });

    const getSetFilterFn = () => {
      const MultipleChoiceSummaryMock = vi.mocked(MultipleChoiceSummary);
      return MultipleChoiceSummaryMock.mock.calls[0][0].setFilter;
    };

    test("adds a new filter", () => {
      const setFilter = getSetFilterFn();
      vi.mocked(constructToastMessage).mockReturnValue("Custom add message");

      setFilter(questionId, label, questionType, filterValue, filterComboBoxValue);

      expect(mockSetSelectedFilter).toHaveBeenCalledWith({
        filter: [
          {
            questionType: {
              id: questionId,
              label: label.default,
              questionType: questionType,
              type: OptionsType.QUESTIONS,
            },
            filterType: {
              filterComboBoxValue: filterComboBoxValue,
              filterValue: filterValue,
            },
          },
        ],
        responseStatus: "all",
      });
      // Ensure vi.mocked(toast.success) refers to the spy from the named export
      expect(vi.mocked(toast).success).toHaveBeenCalledWith("Custom add message", { duration: 5000 });
      expect(vi.mocked(constructToastMessage)).toHaveBeenCalledWith(
        questionType,
        filterValue,
        mockSurvey,
        questionId,
        expect.any(Function), // t function
        filterComboBoxValue
      );
    });

    test("updates an existing filter", () => {
      const existingFilter = {
        questionType: {
          id: questionId,
          label: label.default,
          questionType: questionType,
          type: OptionsType.QUESTIONS,
        },
        filterType: {
          filterComboBoxValue: "old_value_combo",
          filterValue: "old_value",
        },
      };
      vi.mocked(useResponseFilter).mockReturnValue({
        selectedFilter: { filter: [existingFilter], responseStatus: "all" },
        setSelectedFilter: mockSetSelectedFilter,
        resetFilter: vi.fn(),
      } as any);
      // Re-render or get setFilter again as selectedFilter changed
      cleanup();
      const mockSummaryItem = createMockQuestionSummary(questionId, questionType, label.default);
      render(<SummaryList {...defaultProps} summary={[mockSummaryItem]} />);
      const setFilter = getSetFilterFn();

      const newFilterValue = "New Choice";
      const newFilterComboBoxValue = "new_choice_id";
      setFilter(questionId, label, questionType, newFilterValue, newFilterComboBoxValue);

      expect(mockSetSelectedFilter).toHaveBeenCalledWith({
        filter: [
          {
            questionType: {
              id: questionId,
              label: label.default,
              questionType: questionType,
              type: OptionsType.QUESTIONS,
            },
            filterType: {
              filterComboBoxValue: newFilterComboBoxValue,
              filterValue: newFilterValue,
            },
          },
        ],
        responseStatus: "all",
      });
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "environments.surveys.summary.filter_updated_successfully",
        {
          duration: 5000,
        }
      );
    });
  });
});
