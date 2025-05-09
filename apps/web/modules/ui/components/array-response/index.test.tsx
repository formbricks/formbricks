import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ArrayResponse } from "./index";

describe("ArrayResponse", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders array of values correctly", () => {
    const testValues = ["Item 1", "Item 2", "Item 3"];
    render(<ArrayResponse value={testValues} />);

    testValues.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  test("doesn't render empty or falsy values", () => {
    const testValues = ["Item 1", "", "Item 3", null, undefined, false];
    const { container } = render(<ArrayResponse value={testValues as string[]} />);

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();

    // Count the actual rendered divs to verify only 2 items are rendered
    const renderedDivs = container.querySelectorAll(".my-1.font-normal.text-slate-700 > div");
    expect(renderedDivs.length).toBe(2);
  });

  test("renders correct number of items", () => {
    const testValues = ["Item 1", "Item 2", "Item 3"];
    render(<ArrayResponse value={testValues} />);

    const items = screen.getAllByText(/Item/);
    expect(items.length).toBe(3);
  });

  test("renders empty with empty array", () => {
    const { container } = render(<ArrayResponse value={[]} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
