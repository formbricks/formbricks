import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SkeletonLoader } from "./index";

// Mock the Skeleton component
vi.mock("@/modules/ui/components/skeleton", () => ({
  Skeleton: ({ className, children }: { className: string; children: React.ReactNode }) => (
    <div data-testid="mocked-skeleton" className={className}>
      {children}
    </div>
  ),
}));

describe("SkeletonLoader", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders summary skeleton loader correctly", () => {
    render(<SkeletonLoader type="summary" />);

    expect(screen.getByTestId("skeleton-loader-summary")).toBeInTheDocument();
    expect(screen.getByTestId("mocked-skeleton")).toHaveClass("group");
    expect(screen.getByTestId("mocked-skeleton")).toHaveClass("space-y-4");
    expect(screen.getByTestId("mocked-skeleton")).toHaveClass("rounded-xl");
    expect(screen.getByTestId("mocked-skeleton")).toHaveClass("bg-white");
    expect(screen.getByTestId("mocked-skeleton")).toHaveClass("p-6");

    // Check for skeleton elements inside
    const skeletonElements = document.querySelectorAll(".bg-slate-200");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  test("renders response skeleton loader correctly", () => {
    render(<SkeletonLoader type="response" />);

    expect(screen.getByTestId("skeleton-loader-response")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-loader-response")).toHaveClass("group");
    expect(screen.getByTestId("skeleton-loader-response")).toHaveClass("space-y-4");
    expect(screen.getByTestId("skeleton-loader-response")).toHaveClass("rounded-lg");
    expect(screen.getByTestId("skeleton-loader-response")).toHaveClass("bg-white");
    expect(screen.getByTestId("skeleton-loader-response")).toHaveClass("p-6");

    // Check for skeleton elements inside
    const skeletonElements = document.querySelectorAll(".bg-slate-200");
    expect(skeletonElements.length).toBeGreaterThan(0);

    // Check for profile skeleton
    const profileSkeleton = document.querySelector(".h-12.w-12.flex-shrink-0.rounded-full");
    expect(profileSkeleton).toBeInTheDocument();
  });

  test("renders different structures for summary and response types", () => {
    const { rerender } = render(<SkeletonLoader type="summary" />);

    const summaryContainer = screen.getByTestId("skeleton-loader-summary");
    expect(summaryContainer).toBeInTheDocument();
    expect(summaryContainer).toHaveClass("rounded-xl");
    expect(summaryContainer).toHaveClass("border-slate-200");

    // Rerender with response type
    rerender(<SkeletonLoader type="response" />);

    expect(screen.queryByTestId("skeleton-loader-summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("skeleton-loader-response")).toBeInTheDocument();

    // Response type has no border class
    const responseContainer = screen.getByTestId("skeleton-loader-response");
    expect(responseContainer).not.toHaveClass("border");
    expect(responseContainer).not.toHaveClass("border-slate-200");
  });
});
