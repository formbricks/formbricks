import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LinkSurveyLoading } from "./loading";

describe("LinkSurveyLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading component correctly", () => {
    const { container } = render(<LinkSurveyLoading />);

    // Check if main container is rendered with correct classes
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass("flex h-full w-full items-center justify-center");

    // Check for loading animation elements
    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBe(2);
  });
});
