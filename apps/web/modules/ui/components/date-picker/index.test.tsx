import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DatePicker } from "./index";

// Mock the Calendar component from react-calendar
vi.mock("react-calendar", () => ({
  default: ({ value, onChange }) => (
    <div data-testid="mock-calendar">
      <button data-testid="calendar-day" onClick={() => onChange(new Date(2023, 5, 15))}>
        Select Date
      </button>
      <span>Current value: {value?.toString()}</span>
    </div>
  ),
}));

describe("DatePicker", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with null date", () => {
    const mockUpdateSurveyDate = vi.fn();

    render(<DatePicker date={null} updateSurveyDate={mockUpdateSurveyDate} />);

    // Should display "Pick a date" button
    expect(screen.getByText("common.pick_a_date")).toBeInTheDocument();
  });

  test("renders correctly with a date", () => {
    const mockUpdateSurveyDate = vi.fn();
    const testDate = new Date(2023, 5, 15); // June 15, 2023
    const formattedDate = format(testDate, "do MMM, yyyy"); // "15th Jun, 2023"

    render(<DatePicker date={testDate} updateSurveyDate={mockUpdateSurveyDate} />);

    // Should display the formatted date
    expect(screen.getByText(formattedDate)).toBeInTheDocument();
  });

  test("opens calendar popover when clicked", async () => {
    const mockUpdateSurveyDate = vi.fn();
    const user = userEvent.setup();

    render(<DatePicker date={null} updateSurveyDate={mockUpdateSurveyDate} />);

    // Click on the button to open the calendar
    await user.click(screen.getByText("common.pick_a_date"));

    // Calendar should be displayed
    expect(screen.getByTestId("mock-calendar")).toBeInTheDocument();
  });

  test("calls updateSurveyDate when a date is selected", async () => {
    const mockUpdateSurveyDate = vi.fn();
    const user = userEvent.setup();

    render(<DatePicker date={null} updateSurveyDate={mockUpdateSurveyDate} />);

    // Click to open the calendar
    await user.click(screen.getByText("common.pick_a_date"));

    // Click on a day in the calendar
    await user.click(screen.getByTestId("calendar-day"));

    // Should call updateSurveyDate with the selected date
    expect(mockUpdateSurveyDate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSurveyDate).toHaveBeenCalledWith(expect.any(Date));
  });

  test("formats date correctly with ordinal suffixes", async () => {
    const mockUpdateSurveyDate = vi.fn();
    const user = userEvent.setup();
    const selectedDate = new Date(2023, 5, 15); // June 15, 2023

    render(<DatePicker date={null} updateSurveyDate={mockUpdateSurveyDate} />);

    // Click to open the calendar
    await user.click(screen.getByText("common.pick_a_date"));

    // Simulate selecting a date (the mock Calendar will return June 15, 2023)
    await user.click(screen.getByTestId("calendar-day"));

    // Check if updateSurveyDate was called with the expected date
    expect(mockUpdateSurveyDate).toHaveBeenCalledWith(expect.any(Date));

    // Check that the formatted date shows on the button after selection
    // The button now should show "15th Jun, 2023" with the correct ordinal suffix
    const day = selectedDate.getDate();
    const expectedSuffix = "th"; // 15th
    const formattedDateWithSuffix = format(selectedDate, `d'${expectedSuffix}' MMM, yyyy`);

    // Re-render with the selected date since our component doesn't auto-update in tests
    cleanup();
    render(<DatePicker date={selectedDate} updateSurveyDate={mockUpdateSurveyDate} />);
    expect(screen.getByText(formattedDateWithSuffix)).toBeInTheDocument();
  });
});
