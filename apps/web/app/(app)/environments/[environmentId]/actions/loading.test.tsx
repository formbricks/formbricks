import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

// Mock child components
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-content-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle }: { pageTitle: string }) => <div data-testid="page-header">{pageTitle}</div>,
}));

describe("Loading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading state correctly", () => {
    render(<Loading />);

    // Check if mocked components are rendered
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toHaveTextContent("common.actions");

    // Check for translated table headers
    expect(screen.getByText("environments.actions.user_actions")).toBeInTheDocument();
    expect(screen.getByText("common.created")).toBeInTheDocument();
    expect(screen.getByText("common.edit")).toBeInTheDocument(); // Screen reader text

    // Check for skeleton elements (presence of animate-pulse class)
    const skeletonElements = document.querySelectorAll(".animate-pulse");
    expect(skeletonElements.length).toBeGreaterThan(0); // Ensure some skeleton elements are rendered

    // Check for the presence of multiple skeleton rows (3 rows * 4 pulse elements per row = 12)
    const pulseDivs = screen.getAllByText((_, element) => {
      return element?.tagName.toLowerCase() === "div" && element.classList.contains("animate-pulse");
    });
    expect(pulseDivs.length).toBe(3 * 4); // 3 rows, 4 pulsing divs per row (icon, name, desc, created)
  });
});
