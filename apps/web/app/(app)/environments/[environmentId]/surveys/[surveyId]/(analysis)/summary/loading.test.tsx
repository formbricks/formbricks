import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle }) => <h1>{pageTitle}</h1>,
}));

vi.mock("@/modules/ui/components/skeleton-loader", () => ({
  SkeletonLoader: ({ type }) => <div data-testid="skeleton-loader">{`Skeleton type: ${type}`}</div>,
}));

describe("Loading Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render the loading state correctly", () => {
    render(<Loading />);

    expect(screen.getByText("common.summary")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-loader")).toHaveTextContent("Skeleton type: summary");

    const pulseDivs = screen.getAllByRole("generic", { hidden: true }); // Using generic role as divs don't have implicit roles
    // Filter divs that are part of the pulse animation
    const animatedDivs = pulseDivs.filter(
      (div) =>
        div.classList.contains("h-9") &&
        div.classList.contains("w-36") &&
        div.classList.contains("rounded-full") &&
        div.classList.contains("bg-slate-200")
    );
    expect(animatedDivs.length).toBe(4);
  });
});
