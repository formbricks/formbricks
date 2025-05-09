import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SummaryPage } from "./SummaryPage";

// Mock actions
vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions", () => ({
  getResponseCountAction: vi.fn().mockResolvedValue({ data: 42 }),
  getSurveySummaryAction: vi.fn().mockResolvedValue({
    data: {
      meta: {
        completedPercentage: 80,
        completedResponses: 40,
        displayCount: 50,
        dropOffPercentage: 20,
        dropOffCount: 10,
        startsPercentage: 100,
        totalResponses: 50,
        ttcAverage: 120,
      },
      dropOff: [
        {
          questionId: "q1",
          headline: "Question 1",
          questionType: "openText",
          ttc: 20000,
          impressions: 50,
          dropOffCount: 5,
          dropOffPercentage: 10,
        },
      ],
      summary: [
        {
          question: { id: "q1", headline: "Question 1", type: "openText", required: true },
          responseCount: 45,
          type: "openText",
          samples: [],
        },
      ],
    },
  }),
}));

vi.mock("@/app/share/[sharingKey]/actions", () => ({
  getResponseCountBySurveySharingKeyAction: vi.fn().mockResolvedValue({ data: 42 }),
  getSummaryBySurveySharingKeyAction: vi.fn().mockResolvedValue({
    data: {
      meta: {
        completedPercentage: 80,
        completedResponses: 40,
        displayCount: 50,
        dropOffPercentage: 20,
        dropOffCount: 10,
        startsPercentage: 100,
        totalResponses: 50,
        ttcAverage: 120,
      },
      dropOff: [
        {
          questionId: "q1",
          headline: "Question 1",
          questionType: "openText",
          ttc: 20000,
          impressions: 50,
          dropOffCount: 5,
          dropOffPercentage: 10,
        },
      ],
      summary: [
        {
          question: { id: "q1", headline: "Question 1", type: "openText", required: true },
          responseCount: 45,
          type: "openText",
          samples: [],
        },
      ],
    },
  }),
}));

// Mock components
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs",
  () => ({
    SummaryDropOffs: () => <div data-testid="summary-drop-offs">DropOffs Component</div>,
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryList",
  () => ({
    SummaryList: ({ summary, responseCount }: any) => (
      <div data-testid="summary-list">
        <span>Response Count: {responseCount}</span>
        <span>Summary Items: {summary.length}</span>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata",
  () => ({
    SummaryMetadata: ({ showDropOffs, setShowDropOffs, isLoading }: any) => (
      <div data-testid="summary-metadata">
        <span>Is Loading: {isLoading ? "true" : "false"}</span>
        <button onClick={() => setShowDropOffs(!showDropOffs)}>Toggle Dropoffs</button>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ScrollToTop",
  () => ({
    __esModule: true,
    default: () => <div data-testid="scroll-to-top">Scroll To Top</div>,
  })
);

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter", () => ({
  CustomFilter: () => <div data-testid="custom-filter">Custom Filter</div>,
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton", () => ({
  ResultsShareButton: () => <div data-testid="results-share-button">Share Results</div>,
}));

// Mock context
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: () => ({
    selectedFilter: { filter: [], onlyComplete: false },
    dateRange: { from: null, to: null },
    resetState: vi.fn(),
  }),
}));

// Mock hooks
vi.mock("@/lib/utils/hooks/useIntervalWhenFocused", () => ({
  useIntervalWhenFocused: vi.fn(),
}));

vi.mock("@/lib/utils/recall", () => ({
  replaceHeadlineRecall: (survey: any) => survey,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

describe("SummaryPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockEnvironment = { id: "env-123" } as TEnvironment;
  const mockSurvey = {
    id: "survey-123",
    environmentId: "env-123",
  } as TSurvey;
  const locale = "en-US" as TUserLocale;

  const defaultProps = {
    environment: mockEnvironment,
    survey: mockSurvey,
    surveyId: "survey-123",
    webAppUrl: "https://app.example.com",
    totalResponseCount: 50,
    locale,
    isReadOnly: false,
  };

  test("renders loading state initially", () => {
    render(<SummaryPage {...defaultProps} />);

    expect(screen.getByTestId("summary-metadata")).toBeInTheDocument();
    expect(screen.getByText("Is Loading: true")).toBeInTheDocument();
  });

  test("renders summary components after loading", async () => {
    render(<SummaryPage {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText("Is Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByTestId("custom-filter")).toBeInTheDocument();
    expect(screen.getByTestId("results-share-button")).toBeInTheDocument();
    expect(screen.getByTestId("scroll-to-top")).toBeInTheDocument();
    expect(screen.getByTestId("summary-list")).toBeInTheDocument();
  });

  test("shows drop-offs component when toggled", async () => {
    const user = userEvent.setup();
    render(<SummaryPage {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText("Is Loading: false")).toBeInTheDocument();
    });

    // Drop-offs should initially be hidden
    expect(screen.queryByTestId("summary-drop-offs")).not.toBeInTheDocument();

    // Toggle drop-offs
    await user.click(screen.getByText("Toggle Dropoffs"));

    // Drop-offs should now be visible
    expect(screen.getByTestId("summary-drop-offs")).toBeInTheDocument();
  });

  test("doesn't show share button in read-only mode", async () => {
    render(<SummaryPage {...defaultProps} isReadOnly={true} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText("Is Loading: false")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("results-share-button")).not.toBeInTheDocument();
  });
});
