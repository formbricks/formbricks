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
    const { container } = render(<Subheader subheader={subheaderText} questionId={questionId} />);

    const labelElement = container.querySelector(`label[for="${questionId}"]`);
    expect(labelElement).toBeInTheDocument();
    expect(labelElement?.textContent).toBe(subheaderText);

    const textSpan = screen.getByText(subheaderText);
    expect(textSpan).toBeInTheDocument();
    expect(textSpan.tagName).toBe("SPAN");
  });

  test("returns null when no subheader text provided", () => {
    const questionId = "q1";
    const { container } = render(<Subheader questionId={questionId} />);

    const subheaderElement = container.querySelector(`label[for="${questionId}"]`);
    expect(subheaderElement).not.toBeInTheDocument();
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

  test("renders HTML content safely when provided", () => {
    const htmlSubheader = "<p><strong>Bold text</strong></p>";
    const questionId = "q1";
    const { container } = render(<Subheader subheader={htmlSubheader} questionId={questionId} />);

    const labelElement = container.querySelector(`label[for="${questionId}"]`);
    expect(labelElement).toBeInTheDocument();

    const htmlSpan = container.querySelector(".fb-htmlbody");
    expect(htmlSpan).toBeInTheDocument();
    expect(htmlSpan?.innerHTML).toContain("<strong>Bold text</strong>");
  });

  test("renders plain text in span when no HTML detected", () => {
    const plainText = "Plain text without HTML";
    const questionId = "q1";
    const { container } = render(<Subheader subheader={plainText} questionId={questionId} />);

    const labelElement = container.querySelector(`label[for="${questionId}"]`);
    expect(labelElement).toBeInTheDocument();

    const htmlSpan = container.querySelector(".fb-htmlbody");
    expect(htmlSpan).not.toBeInTheDocument();

    const textSpan = screen.getByText(plainText);
    expect(textSpan.tagName).toBe("SPAN");
    expect(textSpan).not.toHaveClass("fb-htmlbody");
  });
});
