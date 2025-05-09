import { DropdownMenuItem } from "@/modules/ui/components/dropdown-menu";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSortOption, TSurveyFilters } from "@formbricks/types/surveys/types";
import { SortOption } from "./sort-option";

// Mock dependencies
vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenuItem: ({ children, className, onClick }: any) => (
    <div data-testid="dropdown-menu-item" className={className} onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

describe("SortOption", () => {
  const mockOption: TSortOption = {
    label: "test.sort.option",
    value: "testValue",
  };

  const mockHandleSortChange = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with the option label", () => {
    render(<SortOption option={mockOption} sortBy="otherValue" handleSortChange={mockHandleSortChange} />);

    expect(screen.getByText("test.sort.option")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-menu-item")).toBeInTheDocument();
  });

  test("applies correct styling when option is selected", () => {
    render(<SortOption option={mockOption} sortBy="testValue" handleSortChange={mockHandleSortChange} />);

    const circleIndicator = screen.getByTestId("dropdown-menu-item").querySelector("span");
    expect(circleIndicator).toHaveClass("bg-brand-dark");
    expect(circleIndicator).toHaveClass("outline-brand-dark");
  });

  test("applies correct styling when option is not selected", () => {
    render(
      <SortOption option={mockOption} sortBy="differentValue" handleSortChange={mockHandleSortChange} />
    );

    const circleIndicator = screen.getByTestId("dropdown-menu-item").querySelector("span");
    expect(circleIndicator).not.toHaveClass("bg-brand-dark");
    expect(circleIndicator).not.toHaveClass("outline-brand-dark");
  });

  test("calls handleSortChange when clicked", async () => {
    const user = userEvent.setup();

    render(<SortOption option={mockOption} sortBy="otherValue" handleSortChange={mockHandleSortChange} />);

    await user.click(screen.getByTestId("dropdown-menu-item"));
    expect(mockHandleSortChange).toHaveBeenCalledTimes(1);
    expect(mockHandleSortChange).toHaveBeenCalledWith(mockOption);
  });

  test("translates the option label", () => {
    render(<SortOption option={mockOption} sortBy="otherValue" handleSortChange={mockHandleSortChange} />);

    // The mock for useTranslate returns the key itself, so we're checking if translation was attempted
    expect(screen.getByText(mockOption.label)).toBeInTheDocument();
  });
});
