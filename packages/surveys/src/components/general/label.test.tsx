import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/preact";
import { describe, expect, test } from "vitest";
import { Label } from "./label";

describe("Label", () => {
  test("renders text content correctly", () => {
    const { container } = render(<Label text="Test Label" />);
    const label = container.querySelector("label");

    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent("Test Label");
  });

  test("applies correct styling classes", () => {
    const { container } = render(<Label text="Test Label" />);
    const label = container.querySelector("label");

    expect(label).toHaveClass("fb-text-subheading", "fb-font-normal", "fb-text-sm");
  });
});
