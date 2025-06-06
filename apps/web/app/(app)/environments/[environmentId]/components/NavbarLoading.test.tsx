import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { NavbarLoading } from "./NavbarLoading";

describe("NavbarLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the correct number of skeleton elements", () => {
    render(<NavbarLoading />);

    // Find all divs with the animate-pulse class
    const skeletonElements = screen.getAllByText((content, element) => {
      return element?.tagName.toLowerCase() === "div" && element.classList.contains("animate-pulse");
    });

    // There are 8 skeleton divs in the component
    expect(skeletonElements).toHaveLength(8);
  });
});
