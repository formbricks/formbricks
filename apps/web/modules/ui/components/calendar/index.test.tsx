import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayPicker } from "react-day-picker";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Calendar } from "./index";

// Mock react-day-picker
vi.mock("react-day-picker", () => {
  const actual = vi.importActual("react-day-picker");
  return {
    ...actual,
    DayPicker: vi.fn(({ className, classNames, showOutsideDays, components, ...props }) => (
      <div data-testid="mock-day-picker" data-show-outside-days={showOutsideDays} className={className}>
        <div data-testid="mock-month">Month Component</div>
        <button data-testid="mock-nav-previous" onClick={() => props.onMonthChange?.(new Date(2023, 0, 1))}>
          Previous
        </button>
        <button data-testid="mock-nav-next" onClick={() => props.onMonthChange?.(new Date(2023, 2, 1))}>
          Next
        </button>
        <div data-testid="mock-day" onClick={() => props.onDayClick?.(new Date(2023, 1, 15))}>
          Day 15
        </div>
      </div>
    )),
    Chevron: vi.fn(() => <span data-testid="mock-chevron">Chevron</span>),
  };
});

describe("Calendar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders DayPicker with default props", () => {
    render(<Calendar />);

    expect(screen.getByTestId("mock-day-picker")).toBeInTheDocument();
    expect(screen.getByTestId("mock-day-picker")).toHaveAttribute("data-show-outside-days", "true");
    expect(screen.getByTestId("mock-day-picker")).toHaveClass("p-3");
  });

  test("passes custom className to DayPicker", () => {
    render(<Calendar className="custom-calendar" />);

    expect(screen.getByTestId("mock-day-picker")).toHaveClass("custom-calendar");
    expect(screen.getByTestId("mock-day-picker")).toHaveClass("p-3");
  });

  test("allows configuring showOutsideDays prop", () => {
    render(<Calendar showOutsideDays={false} />);

    expect(screen.getByTestId("mock-day-picker")).toHaveAttribute("data-show-outside-days", "false");
  });

  test("passes navigation components correctly", async () => {
    const onMonthChange = vi.fn();
    const user = userEvent.setup();

    render(<Calendar onMonthChange={onMonthChange} />);

    await user.click(screen.getByTestId("mock-nav-previous"));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2023, 0, 1));

    await user.click(screen.getByTestId("mock-nav-next"));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2023, 2, 1));
  });

  test("passes day click handler correctly", async () => {
    const onDayClick = vi.fn();
    const user = userEvent.setup();

    render(<Calendar onDayClick={onDayClick} />);

    await user.click(screen.getByTestId("mock-day"));
    expect(onDayClick).toHaveBeenCalledWith(new Date(2023, 1, 15));
  });

  test("has the correct displayName", () => {
    expect(Calendar.displayName).toBe("Calendar");
  });

  test("provides custom Chevron component", () => {
    const { container } = render(<Calendar />);

    // The actual implementation of DayPicker in our test doesn't use the components prop,
    // so we'll check that DayPicker was called with a components object containing Chevron
    expect(DayPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.objectContaining({
          Chevron: expect.any(Function),
        }),
      }),
      expect.anything()
    );
  });
});
