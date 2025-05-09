import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getResponsesDownloadUrlAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { getFormattedFilters, getTodayDate } from "@/app/lib/surveys/surveys";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { CustomFilter } from "./CustomFilter";

vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: vi.fn(),
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions", () => ({
  getResponsesDownloadUrlAction: vi.fn(),
}));

vi.mock("@/app/lib/surveys/surveys", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getFormattedFilters: vi.fn(),
    getTodayDate: vi.fn(),
  };
});

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

vi.mock("@/lib/utils/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@/modules/ui/components/calendar", () => ({
  Calendar: vi.fn(
    ({
      onDayClick,
      onDayMouseEnter,
      onDayMouseLeave,
      selected,
      defaultMonth,
      mode,
      numberOfMonths,
      classNames,
      autoFocus,
    }) => (
      <div data-testid="calendar-mock">
        <span>Calendar Mock</span>
        <button data-testid="calendar-day-button" onClick={() => onDayClick?.(new Date("2024-01-15"))}>
          <span>Click Day</span>
        </button>
        <div
          data-testid="calendar-hover-day" // NOSONAR
          onMouseEnter={() => onDayMouseEnter?.(new Date("2024-01-10"))}>
          <span>Hover Day</span>
        </div>
        <div
          data-testid="calendar-leave-day" // NOSONAR
          onMouseLeave={() => onDayMouseLeave?.()}>
          <span>Leave Day</span>
        </div>
        <div>
          Selected: {selected?.from?.toISOString()} - {selected?.to?.toISOString()}
        </div>
        <div>Default Month: {defaultMonth?.toISOString()}</div>
        <div>Mode: {mode}</div>
        <div>Number of Months: {numberOfMonths}</div>
        <div>ClassNames: {JSON.stringify(classNames)}</div>
        <div>AutoFocus: {String(autoFocus)}</div>
      </div>
    )
  ),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

vi.mock("./ResponseFilter", () => ({
  ResponseFilter: vi.fn(() => <div data-testid="response-filter-mock">ResponseFilter Mock</div>),
}));

const mockSurvey = {
  id: "survey-1",
  name: "Test Survey",
  questions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "app",
  environmentId: "env-1",
  status: "inProgress",
  displayOption: "displayOnce",
  recontactDays: null,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  autoComplete: null,
  surveyClosedMessage: null,
  singleUse: null,
  resultShareKey: null,
  displayPercentage: null,
  languages: [],
  triggers: [],
  welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
} as unknown as TSurvey;

const mockDateToday = new Date("2023-11-20T00:00:00.000Z");

const initialMockUseResponseFilterState = () => ({
  selectedFilter: {},
  dateRange: { from: undefined, to: mockDateToday },
  setDateRange: vi.fn(),
  resetState: vi.fn(),
});

let mockUseResponseFilterState = initialMockUseResponseFilterState();

describe("CustomFilter", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResponseFilterState = initialMockUseResponseFilterState(); // Reset state for each test

    vi.mocked(useResponseFilter).mockImplementation(() => mockUseResponseFilterState as any);
    vi.mocked(useParams).mockReturnValue({ environmentId: "test-env", surveyId: "test-survey" });
    vi.mocked(getFormattedFilters).mockReturnValue({});
    vi.mocked(getTodayDate).mockReturnValue(mockDateToday);
    vi.mocked(getResponsesDownloadUrlAction).mockResolvedValue({ data: "mock-download-url" });
    vi.mocked(getFormattedErrorMessage).mockReturnValue("Mock error message");
  });

  test("renders correctly with initial props", () => {
    render(<CustomFilter survey={mockSurvey} />);
    expect(screen.getByTestId("response-filter-mock")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.all_time")).toBeInTheDocument();
    expect(screen.getByText("common.download")).toBeInTheDocument();
  });

  test("opens custom date picker when 'Custom range' is clicked", async () => {
    const user = userEvent.setup();
    render(<CustomFilter survey={mockSurvey} />);
    const dropdownTrigger = screen.getByText("environments.surveys.summary.all_time").closest("button")!;
    // Similar to above, assuming direct clickability.
    await user.click(dropdownTrigger);
    const customRangeOption = screen.getByText("environments.surveys.summary.custom_range");
    await user.click(customRangeOption);

    expect(screen.getByTestId("calendar-mock")).toBeVisible();
    expect(screen.getByText(`Select first date - ${format(mockDateToday, "dd LLL")}`)).toBeInTheDocument();
  });

  test("does not render download button on sharing page", () => {
    vi.mocked(useParams).mockReturnValue({
      environmentId: "test-env",
      surveyId: "test-survey",
      sharingKey: "test-share-key",
    });
    render(<CustomFilter survey={mockSurvey} />);
    expect(screen.queryByText("common.download")).not.toBeInTheDocument();
  });

  test("useEffect logic for resetState and firstMountRef (as per current component code)", () => {
    // This test verifies the current behavior of the useEffects related to firstMountRef.
    // Based on the component's code, resetState() is not expected to be called by these effects,
    // and firstMountRef.current is not changed by the first useEffect.
    const { rerender } = render(<CustomFilter survey={mockSurvey} />);
    expect(mockUseResponseFilterState.resetState).not.toHaveBeenCalled();

    const newSurvey = { ...mockSurvey, id: "survey-2" };
    rerender(<CustomFilter survey={newSurvey} />);
    expect(mockUseResponseFilterState.resetState).not.toHaveBeenCalled();
  });

  test("closes date picker when clicking outside", async () => {
    const user = userEvent.setup();
    let clickOutsideCallback: Function = () => {};
    vi.mocked(useClickOutside).mockImplementation((_, callback) => {
      clickOutsideCallback = callback;
    });

    render(<CustomFilter survey={mockSurvey} />);
    const dropdownTrigger = screen.getByText("environments.surveys.summary.all_time").closest("button")!; // Ensure targeting button
    await user.click(dropdownTrigger);
    const customRangeOption = screen.getByText("environments.surveys.summary.custom_range");
    await user.click(customRangeOption);
    expect(screen.getByTestId("calendar-mock")).toBeVisible();

    clickOutsideCallback(); // Simulate click outside

    await waitFor(() => {
      expect(screen.queryByTestId("calendar-mock")).not.toBeInTheDocument();
    });
  });
});
