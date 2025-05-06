import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys";
import { ResponseFilter } from "./ResponseFilter";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  POSTHOG_API_KEY: "mock-posthog-api-key",
  POSTHOG_HOST: "mock-posthog-host",
  IS_POSTHOG_CONFIGURED: true,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
  SENTRY_DSN: "mock-sentry-dsn",
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

// Mock context
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: vi.fn(),
}));

// Mock child components
vi.mock("./CustomFilter", () => ({
  CustomFilter: vi.fn(({ setShowFilter }) => (
    <div data-testid="custom-filter">
      CustomFilter
      <button onClick={() => setShowFilter(false)}>Close CustomFilter</button>
    </div>
  )),
}));

vi.mock("./QuestionsComboBox", () => ({
  QuestionsComboBox: vi.fn(({ onSelect }) => (
    <div data-testid="questions-combo-box">
      QuestionsComboBox
      <button onClick={() => onSelect({ id: "question1", label: "Question 1" })}>Select Question</button>
    </div>
  )),
}));

vi.mock("./QuestionFilterComboBox", () => ({
  QuestionFilterComboBox: vi.fn(({ filter, onDeleteFilter }) => (
    <div data-testid={`question-filter-${filter.questionType.id}`}>
      {filter.questionType.label}
      <button onClick={onDeleteFilter}>Delete Filter</button>
    </div>
  )),
}));

// Mock UI components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@/modules/ui/components/switch", () => ({
  Switch: vi.fn(({ checked, onCheckedChange, id }) => (
    <input
      type="checkbox"
      data-testid="switch"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  )),
}));

vi.mock("lucide-react", () => ({
  FilterIcon: () => <div data-testid="filter-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
}));

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  questions: [{ id: "q1", headline: { default: "Question 1" } }],
  hiddenFields: { enabled: true, fieldIds: ["hf1"] },
  languages: [{ code: "en", default: true, enabled: true }],
} as unknown as TSurvey;

const mockSetAppliedFilters = vi.fn();
const mockUseResponseFilterReturn = {
  selectedFilter: { filter: [], onlyComplete: false },
  setSelectedFilter: vi.fn(),
  dateRange: { from: undefined, to: new Date("2024-03-15T00:00:00.000Z") },
  setDateRange: vi.fn(),
  selectedOptions: { questionOptions: [], questionFilterOptions: [] },
  setSelectedOptions: vi.fn(),
  resetState: vi.fn(),
};

describe("ResponseFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useResponseFilter).mockReturnValue(mockUseResponseFilterReturn);
    vi.mocked(useParams).mockReturnValue({ environmentId: "test-env", surveyId: "test-survey" });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders initial state correctly and opens filter menu", async () => {
    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: { from: undefined, to: undefined } }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    // Check for initially visible elements
    const openMenuButton = screen.getByText(/^filter-responses\.filter-button-default-text/);
    expect(openMenuButton).toBeInTheDocument();
    expect(screen.getByText("0 filter-responses.responses-text")).toBeInTheDocument();

    // Open the filter menu
    await userEvent.click(openMenuButton);

    // Now check for elements inside the opened menu
    expect(screen.getByLabelText("filter-responses.complete-only-label")).toBeInTheDocument();
    expect(screen.getByTestId("switch")).not.toBeChecked();
    expect(screen.getByText("filter-responses.add-filter-button")).toBeInTheDocument();
    expect(screen.getByText("filter-responses.reset-all-button")).toBeInTheDocument();
    // In empty state, QuestionsComboBox should be visible
    expect(screen.getByTestId("questions-combo-box")).toBeInTheDocument();
  });

  test("initializes with initialFilters prop", () => {
    const initialFilters = {
      filter: [{ questionType: { id: "q1", label: "Q1" }, filterType: { filterValue: "val" } }],
      onlyComplete: true,
      dateRange: { from: new Date("2023-02-01"), to: new Date("2023-02-28") },
    };
    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={initialFilters}
        setAppliedFilters={mockSetAppliedFilters}
        initialFilters={initialFilters}
      />
    );

    expect(mockUseResponseFilterReturn.setSelectedFilter).toHaveBeenCalledWith({
      filter: initialFilters.filter,
      onlyComplete: initialFilters.onlyComplete,
    });
    expect(mockUseResponseFilterReturn.setDateRange).toHaveBeenCalledWith({
      from: initialFilters.dateRange.from,
      to: initialFilters.dateRange.to,
    });
  });

  test("toggles 'Only complete responses' switch", async () => {
    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: { from: undefined, to: undefined } }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    const openMenuButton = screen.getByText(/^filter-responses\.filter-button-default-text/);
    await userEvent.click(openMenuButton);

    const switchControl = screen.getByTestId("switch");
    await userEvent.click(switchControl);

    expect(mockUseResponseFilterReturn.setSelectedFilter).toHaveBeenCalledWith(
      expect.objectContaining({ onlyComplete: true })
    );
  });

  test("changes date range", async () => {
    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: { from: undefined, to: undefined } }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    const openMenuButton = screen.getByText(/^filter-responses\.filter-button-default-text/);
    await userEvent.click(openMenuButton);

    const setDateButton = screen.getByText("Set Date Range");
    await userEvent.click(setDateButton);

    expect(mockUseResponseFilterReturn.setDateRange).toHaveBeenCalledWith({
      from: new Date("2023-01-01T00:00:00.000Z"),
      to: new Date("2023-01-31T00:00:00.000Z"),
    });
  });

  test("shows and hides CustomFilter modal", async () => {
    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: { from: undefined, to: undefined } }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    const openMenuButton = screen.getByText(/^filter-responses\.filter-button-default-text/);
    await userEvent.click(openMenuButton);

    const addFilterButton = screen.getByText("filter-responses.add-filter-button");
    await userEvent.click(addFilterButton);
    expect(screen.getByTestId("custom-filter")).toBeInTheDocument();

    const closeCustomFilterButton = screen.getByText("Close CustomFilter");
    await userEvent.click(closeCustomFilterButton);
    expect(screen.queryByTestId("custom-filter")).not.toBeInTheDocument();
  });

  test("displays and removes applied filters", async () => {
    const mockFilter = { questionType: { id: "q1", label: "Question 1" }, filterType: { id: "ft1" } };
    vi.mocked(useResponseFilter).mockReturnValue({
      ...mockUseResponseFilterReturn,
      selectedFilter: { filter: [mockFilter], onlyComplete: false },
    });

    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{
          filter: [mockFilter],
          onlyComplete: false,
          dateRange: { from: undefined, to: undefined },
        }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    const openMenuButton = screen.getByText(/^filter-responses\.filter-button-filtered-text/);
    await userEvent.click(openMenuButton);

    expect(screen.getByTestId("question-filter-q1")).toBeInTheDocument();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    // QuestionsComboBox should not be visible when filters are present
    expect(screen.queryByTestId("questions-combo-box")).not.toBeInTheDocument();

    const deleteFilterButton = screen.getByText("Delete Filter");
    await userEvent.click(deleteFilterButton);

    expect(mockUseResponseFilterReturn.setSelectedFilter).toHaveBeenCalledWith(
      expect.objectContaining({ filter: [] })
    );
  });

  test("resets filters", async () => {
    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: { from: undefined, to: undefined } }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    const openMenuButton = screen.getByText(/^filter-responses\.filter-button-default-text/);
    await userEvent.click(openMenuButton);

    const resetButton = screen.getByText("filter-responses.reset-all-button");
    await userEvent.click(resetButton);

    expect(mockUseResponseFilterReturn.resetState).toHaveBeenCalled();
  });

  test("calls setAppliedFilters prop when context changes", () => {
    // This test verifies the useEffect that calls setAppliedFilters
    const newDateRange = { from: new Date("2023-03-01"), to: new Date("2023-03-31") };
    const newSelectedFilter = { filter: [], onlyComplete: true };

    // Initial render
    const { rerender } = render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: { from: undefined, to: undefined } }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    // Simulate context update for dateRange
    vi.mocked(useResponseFilter).mockReturnValue({
      ...mockUseResponseFilterReturn,
      dateRange: newDateRange,
    });
    rerender(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: newDateRange }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );
    expect(mockSetAppliedFilters).toHaveBeenCalledWith(expect.objectContaining({ dateRange: newDateRange }));

    // Simulate context update for selectedFilter
    vi.mocked(useResponseFilter).mockReturnValue({
      ...mockUseResponseFilterReturn,
      selectedFilter: newSelectedFilter,
      dateRange: newDateRange, // keep dateRange to isolate selectedFilter change effect
    });
    rerender(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ ...newSelectedFilter, dateRange: newDateRange }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );
    expect(mockSetAppliedFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: newSelectedFilter.filter,
        onlyComplete: newSelectedFilter.onlyComplete,
      })
    );
  });

  test("renders QuestionsComboBox in empty filter state and handles selection", async () => {
    vi.mocked(useResponseFilter).mockReturnValue({
      ...mockUseResponseFilterReturn,
      selectedFilter: { filter: [], onlyComplete: false }, // Ensure no filters
    });

    render(
      <ResponseFilter
        environmentId="env1"
        surveyId="survey1"
        survey={mockSurvey}
        responses={[]}
        totalResponseCount={0}
        appliedFilters={{ filter: [], onlyComplete: false, dateRange: { from: undefined, to: undefined } }}
        setAppliedFilters={mockSetAppliedFilters}
      />
    );

    const openMenuButton = screen.getByText(/^filter-responses\.filter-button-default-text/);
    await userEvent.click(openMenuButton);

    expect(screen.getByTestId("questions-combo-box")).toBeInTheDocument();
    const selectQuestionButton = screen.getByText("Select Question"); // From QuestionsComboBox mock
    await userEvent.click(selectQuestionButton);

    expect(mockUseResponseFilterReturn.setSelectedOptions).toHaveBeenCalledWith({
      questionOptions: [{ id: "question1", label: "Question 1" }],
      questionFilterOptions: [], // Assuming default empty
    });
    // After selection, CustomFilter should appear
    expect(screen.getByTestId("custom-filter")).toBeInTheDocument();
  });
});
