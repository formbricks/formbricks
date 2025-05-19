import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Skeleton } from "./index";

describe("Skeleton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default styling", () => {
    const { container } = render(<Skeleton />);
    const skeletonElement = container.firstChild as HTMLElement;

    expect(skeletonElement).toBeInTheDocument();
    expect(skeletonElement).toHaveClass("animate-pulse");
    expect(skeletonElement).toHaveClass("rounded-full");
    expect(skeletonElement).toHaveClass("bg-slate-200");
  });

  test("passes additional props", () => {
    const { container } = render(<Skeleton data-testid="test-skeleton" aria-label="Loading" />);
    const skeletonElement = container.firstChild as HTMLElement;

    expect(skeletonElement).toHaveAttribute("data-testid", "test-skeleton");
    expect(skeletonElement).toHaveAttribute("aria-label", "Loading");
  });

  test("renders with children", () => {
    const { container } = render(
      <Skeleton>
        <div>Content</div>
      </Skeleton>
    );

    const skeletonElement = container.firstChild as HTMLElement;
    expect(skeletonElement).toBeInTheDocument();
    expect(skeletonElement.textContent).toBe("Content");
  });
});
