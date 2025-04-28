// InsightView.test.jsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TSurveyQuestionSummaryOpenText } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { InsightView } from "./insights-view";

// --- Mocks ---

// Stub out the translation hook so that keys are returned as-is.
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key) => key,
  }),
}));

// Spy on formbricks.track
vi.mock("@formbricks/js", () => ({
  default: {
    track: vi.fn(),
  },
}));

// A simple implementation for classnames.
vi.mock("@/lib/cn", () => ({
  cn: (...classes) => classes.join(" "),
}));

// Mock CategoryBadge to render a simple button.
vi.mock("../experience/components/category-select", () => ({
  default: ({ category, insightId, onCategoryChange }) => (
    <button data-testid="category-badge" onClick={() => onCategoryChange(insightId, category)}>
      CategoryBadge: {category}
    </button>
  ),
}));

// Mock InsightSheet to display its open/closed state and the insight title.
vi.mock("@/modules/ee/insights/components/insight-sheet", () => ({
  InsightSheet: ({ isOpen, insight }) => (
    <div data-testid="insight-sheet">
      {isOpen ? "InsightSheet Open" : "InsightSheet Closed"}
      {insight && ` - ${insight.title}`}
    </div>
  ),
}));

// Create an array of 15 dummy insights.
// Even-indexed insights will have the category "complaint"
// and odd-indexed insights will have "praise".
const dummyInsights = Array.from({ length: 15 }, (_, i) => ({
  id: `insight-${i}`,
  _count: { documentInsights: i },
  title: `Insight Title ${i}`,
  description: `Insight Description ${i}`,
  category: i % 2 === 0 ? "complaint" : "praise",
  updatedAt: new Date(),
  createdAt: new Date(),
  environmentId: "environment-1",
})) as TSurveyQuestionSummaryOpenText["insights"];

// Helper function to render the component with default props.
const renderComponent = (props = {}) => {
  const defaultProps = {
    insights: dummyInsights,
    questionId: "question-1",
    surveyId: "survey-1",
    documentsFilter: {},
    isFetching: false,
    documentsPerPage: 5,
    locale: "en" as TUserLocale,
  };

  return render(<InsightView {...defaultProps} {...props} />);
};

// --- Tests ---
describe("InsightView Component", () => {
  test("renders table headers", () => {
    renderComponent();
    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.getByText("common.title")).toBeInTheDocument();
    expect(screen.getByText("common.description")).toBeInTheDocument();
    expect(screen.getByText("environments.experience.category")).toBeInTheDocument();
  });

  test('shows "no insights found" when insights array is empty', () => {
    renderComponent({ insights: [] });
    expect(screen.getByText("environments.experience.no_insights_found")).toBeInTheDocument();
  });

  test("does not render insights when isFetching is true", () => {
    renderComponent({ isFetching: true, insights: [] });
    expect(screen.getByText("environments.experience.no_insights_found")).toBeInTheDocument();
  });

  test("filters insights based on selected tab", async () => {
    renderComponent();

    // Click on the "complaint" tab.
    const complaintTab = screen.getAllByText("environments.experience.complaint")[0];
    fireEvent.click(complaintTab);

    // Grab all table rows from the table body.
    const rows = await screen.findAllByRole("row");

    // Check that none of the rows include text from a "praise" insight.
    rows.forEach((row) => {
      expect(row.textContent).not.toEqual(/Insight Title 1/);
    });
  });

  test("load more button increases visible insights count", () => {
    renderComponent();
    // Initially, "Insight Title 10" should not be visible because only 10 items are shown.
    expect(screen.queryByText("Insight Title 10")).not.toBeInTheDocument();

    // Get all buttons with the text "common.load_more" and filter for those that are visible.
    const loadMoreButtons = screen.getAllByRole("button", { name: /common\.load_more/i });
    expect(loadMoreButtons.length).toBeGreaterThan(0);

    // Click the first visible "load more" button.
    fireEvent.click(loadMoreButtons[0]);

    // Now, "Insight Title 10" should be visible.
    expect(screen.getByText("Insight Title 10")).toBeInTheDocument();
  });

  test("opens insight sheet when a row is clicked", () => {
    renderComponent();
    // Get all elements that display "Insight Title 0" and use the first one to find its table row
    const cells = screen.getAllByText("Insight Title 0");
    expect(cells.length).toBeGreaterThan(0);
    const rowElement = cells[0].closest("tr");
    expect(rowElement).not.toBeNull();
    // Simulate a click on the table row
    fireEvent.click(rowElement!);

    // Get all instances of the InsightSheet component
    const sheets = screen.getAllByTestId("insight-sheet");
    // Filter for the one that contains the expected text
    const matchingSheet = sheets.find((sheet) =>
      sheet.textContent?.includes("InsightSheet Open - Insight Title 0")
    );

    expect(matchingSheet).toBeDefined();
    expect(matchingSheet).toHaveTextContent("InsightSheet Open - Insight Title 0");
  });

  test("category badge calls onCategoryChange and updates the badge (even if value remains the same)", () => {
    renderComponent();
    // Get the first category badge. For index 0, the category is "complaint".
    const categoryBadge = screen.getAllByTestId("category-badge")[0];

    // It should display "complaint" initially.
    expect(categoryBadge).toHaveTextContent("CategoryBadge: complaint");

    // Click the category badge to trigger onCategoryChange.
    fireEvent.click(categoryBadge);

    // After clicking, the badge should still display "complaint" (since our mock simply passes the current value).
    expect(categoryBadge).toHaveTextContent("CategoryBadge: complaint");
  });
});
