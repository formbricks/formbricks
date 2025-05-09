import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { Subheader } from "./subheader";

describe("Subheader", () => {
  afterEach(() => {
    cleanup();
  });
  test("renders subheader text when provided", () => {
    const subheaderText = "Test subheader text";
    const questionId = "q1";
    render(<Subheader subheader={subheaderText} questionId={questionId} />);

    const subheaderElement = screen.getByText(subheaderText);
    expect(subheaderElement).toBeInTheDocument();
    expect(subheaderElement.tagName).toBe("LABEL");
    expect(subheaderElement).toHaveAttribute("for", questionId);
  });

  test("renders empty label when no subheader text provided", () => {
    const questionId = "q1";
    const { container } = render(<Subheader questionId={questionId} />);

    const subheaderElement = container.querySelector(`label[for="${questionId}"]`);
    expect(subheaderElement).toBeInTheDocument();
    expect(subheaderElement).toHaveClass(
      "fb-text-subheading",
      "fb-block",
      "fb-break-words",
      "fb-text-sm",
      "fb-font-normal",
      "fb-leading-6"
    );
    expect(subheaderElement).toHaveAttribute("dir", "auto");
    expect(subheaderElement?.textContent).toBe("");
  });

  test("applies correct styling classes", () => {
    const { container } = render(<Subheader subheader="Styling Test" questionId="q1" />);

    const subheaderElement = container.querySelector('label[for="q1"]');
    expect(subheaderElement).toHaveClass(
      "fb-text-subheading",
      "fb-block",
      "fb-break-words",
      "fb-text-sm",
      "fb-font-normal",
      "fb-leading-6"
    );
  });

  test("has correct dir attribute", () => {
    const { container } = render(<Subheader subheader="Direction Test" questionId="q1" />);

    const subheaderElement = container.querySelector('label[for="q1"]');
    expect(subheaderElement).toHaveAttribute("dir", "auto");
  });
});
