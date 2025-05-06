import { QuestionOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionsComboBox";
import { QuestionFilterOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResponseFilter";
import { getTodayDate } from "@/app/lib/surveys/surveys";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResponseFilterProvider, useResponseFilter } from "./ResponseFilterContext";

// Mock the getTodayDate function
vi.mock("@/app/lib/surveys/surveys", () => ({
  getTodayDate: vi.fn(),
}));

const mockToday = new Date("2024-01-15T00:00:00.000Z");
const mockFromDate = new Date("2024-01-01T00:00:00.000Z");

// Test component to use the hook
const TestComponent = () => {
  const {
    selectedFilter,
    setSelectedFilter,
    selectedOptions,
    setSelectedOptions,
    dateRange,
    setDateRange,
    resetState,
  } = useResponseFilter();

  return (
    <div>
      <div data-testid="onlyComplete">{selectedFilter.onlyComplete.toString()}</div>
      <div data-testid="filterLength">{selectedFilter.filter.length}</div>
      <div data-testid="questionOptionsLength">{selectedOptions.questionOptions.length}</div>
      <div data-testid="questionFilterOptionsLength">{selectedOptions.questionFilterOptions.length}</div>
      <div data-testid="dateFrom">{dateRange.from?.toISOString()}</div>
      <div data-testid="dateTo">{dateRange.to?.toISOString()}</div>

      <button
        onClick={() =>
          setSelectedFilter({
            filter: [
              {
                questionType: { id: "q1", label: "Question 1" },
                filterType: { filterValue: "value1", filterComboBoxValue: "option1" },
              },
            ],
            onlyComplete: true,
          })
        }>
        Update Filter
      </button>
      <button
        onClick={() =>
          setSelectedOptions({
            questionOptions: [{ header: "q1" } as unknown as QuestionOptions],
            questionFilterOptions: [{ id: "qFilterOpt1" } as unknown as QuestionFilterOptions],
          })
        }>
        Update Options
      </button>
      <button onClick={() => setDateRange({ from: mockFromDate, to: mockToday })}>Update Date Range</button>
      <button onClick={resetState}>Reset State</button>
    </div>
  );
};

describe("ResponseFilterContext", () => {
  beforeEach(() => {
    vi.mocked(getTodayDate).mockReturnValue(mockToday);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("should provide initial state values", () => {
    render(
      <ResponseFilterProvider>
        <TestComponent />
      </ResponseFilterProvider>
    );

    expect(screen.getByTestId("onlyComplete").textContent).toBe("false");
    expect(screen.getByTestId("filterLength").textContent).toBe("0");
    expect(screen.getByTestId("questionOptionsLength").textContent).toBe("0");
    expect(screen.getByTestId("questionFilterOptionsLength").textContent).toBe("0");
    expect(screen.getByTestId("dateFrom").textContent).toBe("");
    expect(screen.getByTestId("dateTo").textContent).toBe(mockToday.toISOString());
  });

  test("should update selectedFilter state", async () => {
    render(
      <ResponseFilterProvider>
        <TestComponent />
      </ResponseFilterProvider>
    );

    const updateButton = screen.getByText("Update Filter");
    await userEvent.click(updateButton);

    expect(screen.getByTestId("onlyComplete").textContent).toBe("true");
    expect(screen.getByTestId("filterLength").textContent).toBe("1");
  });

  test("should update selectedOptions state", async () => {
    render(
      <ResponseFilterProvider>
        <TestComponent />
      </ResponseFilterProvider>
    );

    const updateButton = screen.getByText("Update Options");
    await userEvent.click(updateButton);

    expect(screen.getByTestId("questionOptionsLength").textContent).toBe("1");
    expect(screen.getByTestId("questionFilterOptionsLength").textContent).toBe("1");
  });

  test("should update dateRange state", async () => {
    render(
      <ResponseFilterProvider>
        <TestComponent />
      </ResponseFilterProvider>
    );

    const updateButton = screen.getByText("Update Date Range");
    await userEvent.click(updateButton);

    expect(screen.getByTestId("dateFrom").textContent).toBe(mockFromDate.toISOString());
    expect(screen.getByTestId("dateTo").textContent).toBe(mockToday.toISOString());
  });

  test("should throw error when useResponseFilter is used outside of Provider", () => {
    // Hide console error temporarily
    const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow("useFilterDate must be used within a FilterDateProvider");
    consoleErrorMock.mockRestore();
  });
});
