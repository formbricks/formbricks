import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SearchBar } from "./index";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Search: () => <div data-testid="search-icon" />,
}));

describe("SearchBar", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default placeholder", () => {
    render(<SearchBar value="" onChange={() => {}} />);

    expect(screen.getByPlaceholderText("Search by survey name")).toBeInTheDocument();
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  test("renders with custom placeholder", () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Custom placeholder" />);

    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
  });

  test("displays the provided value", () => {
    render(<SearchBar value="test query" onChange={() => {}} />);

    const input = screen.getByPlaceholderText("Search by survey name") as HTMLInputElement;
    expect(input.value).toBe("test query");
  });

  test("applies custom className", () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} className="custom-class" />);

    const searchBarContainer = container.firstChild as HTMLElement;
    expect(searchBarContainer).toHaveClass("custom-class");
    expect(searchBarContainer).toHaveClass("flex");
    expect(searchBarContainer).toHaveClass("h-8");
  });
});
