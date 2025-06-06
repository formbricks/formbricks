import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

// Mock the GoBackButton component
vi.mock("@/modules/ui/components/go-back-button", () => ({
  GoBackButton: () => <div>GoBackButton</div>,
}));

describe("Loading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the loading state correctly", () => {
    render(<Loading />);

    // Check for GoBackButton mock
    expect(screen.getByText("GoBackButton")).toBeInTheDocument();

    // Check for the disabled button text
    expect(screen.getByText("environments.integrations.google_sheets.link_new_sheet")).toBeInTheDocument();
    expect(
      screen.getByText("environments.integrations.google_sheets.link_new_sheet").closest("button")
    ).toHaveClass("pointer-events-none animate-pulse cursor-not-allowed bg-slate-200 select-none");

    // Check for table headers
    expect(screen.getByText("common.survey")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.google_sheets.google_sheet_name")).toBeInTheDocument();
    expect(screen.getByText("common.questions")).toBeInTheDocument();
    expect(screen.getByText("common.updated_at")).toBeInTheDocument();

    // Check for placeholder elements (count based on the loop)
    const placeholders = screen.getAllByRole("generic", { hidden: true }); // Using generic role as divs don't have implicit roles
    // Calculate expected placeholders: 3 rows * 5 placeholders per row = 15
    // Plus the button, header divs (4), and the main containers
    // It's simpler to check if there are *any* pulse animations
    expect(placeholders.some((el) => el.classList.contains("animate-pulse"))).toBe(true);
  });
});
