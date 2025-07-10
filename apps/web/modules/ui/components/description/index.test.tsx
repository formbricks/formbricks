import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Description } from "./index";

describe("Description", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders children text content", () => {
    render(<Description>This is a description</Description>);

    const description = screen.getByText("This is a description");
    expect(description).toBeInTheDocument();
  });

  test("applies correct CSS classes", () => {
    render(<Description>Test description</Description>);

    const description = screen.getByText("Test description");
    expect(description).toHaveClass("mt-1", "text-sm", "text-slate-500");
    expect(description.tagName).toBe("P");
  });

  test("renders with React element children", () => {
    render(
      <Description>
        <span data-testid="description-content">Complex description content</span>
      </Description>
    );

    const content = screen.getByTestId("description-content");
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("Complex description content");
  });
});
