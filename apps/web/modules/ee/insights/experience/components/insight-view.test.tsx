import { TInsightWithDocumentCount } from "@/modules/ee/insights/experience/types/insights";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TUserLocale } from "@formbricks/types/user";
import { InsightView } from "./insight-view";

// Mock the translation hook to simply return the key.
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the action that fetches insights.
const mockGetEnvironmentInsightsAction = vi.fn();
vi.mock("../actions", () => ({
  getEnvironmentInsightsAction: (...args: any[]) => mockGetEnvironmentInsightsAction(...args),
}));

// Mock InsightSheet so we can assert on its open state.
vi.mock("@/modules/ee/insights/components/insight-sheet", () => ({
  InsightSheet: ({
    isOpen,
    insight,
  }: {
    isOpen: boolean;
    insight: any;
    setIsOpen: any;
    handleFeedback: any;
    documentsFilter: any;
    documentsPerPage: number;
    locale: string;
  }) => (
    <div data-testid="insight-sheet">
      {isOpen ? `InsightSheet Open${insight ? ` - ${insight.title}` : ""}` : "InsightSheet Closed"}
    </div>
  ),
}));

// Mock InsightLoading.
vi.mock("./insight-loading", () => ({
  InsightLoading: () => <div data-testid="insight-loading">Loading...</div>,
}));

// For simplicity, we won’t mock CategoryBadge so it renders normally.
// If needed, you can also mock it similar to InsightSheet.

// --- Dummy Data ---
const dummyInsight1 = {
  id: "1",
  title: "Insight 1",
  description: "Description 1",
  category: "featureRequest",
  _count: { documentInsights: 5 },
};
const dummyInsight2 = {
  id: "2",
  title: "Insight 2",
  description: "Description 2",
  category: "featureRequest",
  _count: { documentInsights: 3 },
};
const dummyInsightComplaint = {
  id: "3",
  title: "Complaint Insight",
  description: "Complaint Description",
  category: "complaint",
  _count: { documentInsights: 10 },
};
const dummyInsightPraise = {
  id: "4",
  title: "Praise Insight",
  description: "Praise Description",
  category: "praise",
  _count: { documentInsights: 8 },
};

// A helper to render the component with required props.
const renderComponent = (props = {}) => {
  const defaultProps = {
    statsFrom: new Date("2023-01-01"),
    environmentId: "env-1",
    insightsPerPage: 2,
    documentsPerPage: 5,
    locale: "en-US" as TUserLocale,
  };

  return render(<InsightView {...defaultProps} {...props} />);
};

// --- Tests ---
describe("InsightView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders "no insights found" message when insights array is empty', async () => {
    // Set up the mock to return an empty array.
    mockGetEnvironmentInsightsAction.mockResolvedValueOnce({ data: [] });
    renderComponent();
    // Wait for the useEffect to complete.
    await waitFor(() => {
      expect(screen.getByText("environments.experience.no_insights_found")).toBeInTheDocument();
    });
  });

  test("renders table rows when insights are fetched", async () => {
    // Return two insights for the initial fetch.
    mockGetEnvironmentInsightsAction.mockResolvedValueOnce({ data: [dummyInsight1, dummyInsight2] });
    renderComponent();
    // Wait until the insights are rendered.
    await waitFor(() => {
      expect(screen.getByText("Insight 1")).toBeInTheDocument();
      expect(screen.getByText("Insight 2")).toBeInTheDocument();
    });
  });

  test("opens insight sheet when a table row is clicked", async () => {
    mockGetEnvironmentInsightsAction.mockResolvedValueOnce({ data: [dummyInsight1] });
    renderComponent();
    // Wait for the insight to appear.
    await waitFor(() => {
      expect(screen.getAllByText("Insight 1").length).toBeGreaterThan(0);
    });

    // Instead of grabbing the first "Insight 1" cell,
    // get all table rows (they usually have role="row") and then find the row that contains "Insight 1".
    const rows = screen.getAllByRole("row");
    const targetRow = rows.find((row) => row.textContent?.includes("Insight 1"));

    console.log(targetRow?.textContent);

    expect(targetRow).toBeTruthy();

    // Click the entire row.
    fireEvent.click(targetRow!);

    // Wait for the InsightSheet to update.
    await waitFor(() => {
      const sheet = screen.getAllByTestId("insight-sheet");

      const matchingSheet = sheet.find((s) => s.textContent?.includes("InsightSheet Open - Insight 1"));
      expect(matchingSheet).toBeInTheDocument();
    });
  });

  test("clicking load more fetches next page of insights", async () => {
    // First fetch returns two insights.
    mockGetEnvironmentInsightsAction.mockResolvedValueOnce({ data: [dummyInsight1, dummyInsight2] });
    // Second fetch returns one additional insight.
    mockGetEnvironmentInsightsAction.mockResolvedValueOnce({ data: [dummyInsightPraise] });
    renderComponent();

    // Wait for the initial insights to be rendered.
    await waitFor(() => {
      expect(screen.getAllByText("Insight 1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Insight 2").length).toBeGreaterThan(0);
    });

    // The load more button should be visible because hasMore is true.
    const loadMoreButton = screen.getAllByText("common.load_more")[0];
    fireEvent.click(loadMoreButton);

    // Wait for the new insight to be appended.
    await waitFor(() => {
      expect(screen.getAllByText("Praise Insight").length).toBeGreaterThan(0);
    });
  });

  test("changes filter tab and re-fetches insights", async () => {
    // For initial active tab "featureRequest", return a featureRequest insight.
    mockGetEnvironmentInsightsAction.mockResolvedValueOnce({ data: [dummyInsight1] });
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText("Insight 1")[0]).toBeInTheDocument();
    });

    mockGetEnvironmentInsightsAction.mockResolvedValueOnce({
      data: [dummyInsightComplaint as TInsightWithDocumentCount],
    });

    renderComponent();

    // Find the complaint tab and click it.
    const complaintTab = screen.getAllByText("environments.experience.complaint")[0];
    fireEvent.click(complaintTab);

    // Wait until the new complaint insight is rendered.
    await waitFor(() => {
      expect(screen.getAllByText("Complaint Insight")[0]).toBeInTheDocument();
    });
  });

  test("shows loading indicator when fetching insights", async () => {
    // Make the mock return a promise that doesn't resolve immediately.
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockGetEnvironmentInsightsAction.mockReturnValueOnce(fetchPromise);
    renderComponent();

    // While fetching, the loading indicator should be visible.
    expect(screen.getByTestId("insight-loading")).toBeInTheDocument();

    // Resolve the fetch.
    resolveFetch({ data: [dummyInsight1] });
    await waitFor(() => {
      // After fetching, the loading indicator should disappear.
      expect(screen.queryByTestId("insight-loading")).not.toBeInTheDocument();
      // Instead of getByText, use getAllByText to assert at least one instance of "Insight 1" exists.
      expect(screen.getAllByText("Insight 1").length).toBeGreaterThan(0);
    });
  });
});
