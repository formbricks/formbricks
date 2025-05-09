import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/preact";
import DOMPurify from "isomorphic-dompurify";
import { describe, expect, test, vi } from "vitest";
import { HtmlBody } from "./html-body";

// Mock DOMPurify to test sanitization
vi.mock("isomorphic-dompurify", () => ({
  default: {
    sanitize: vi.fn((html) => html), // Pass through the HTML for testing
  },
}));

describe("HtmlBody", () => {
  const defaultProps = {
    questionId: "test-id" as const,
  };

  test("renders sanitized HTML content", async () => {
    const htmlString = "<p>Test content</p>";
    const { container } = render(<HtmlBody {...defaultProps} htmlString={htmlString} />);

    await waitFor(() => {
      const label = container.querySelector("label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute("for", "test-id");
      expect(label).toHaveClass("fb-htmlbody", "fb-break-words");
      expect(label).toHaveAttribute("dir", "auto");
      expect(label?.innerHTML).toBe(htmlString);
    });

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(htmlString, { ADD_ATTR: ["target"] });
  });

  test("returns null when htmlString is not provided", () => {
    const { container } = render(<HtmlBody {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  test("returns null for empty editor paragraph", async () => {
    const emptyEditorHtml = '<p class="fb-editor-paragraph"><br></p>';
    const { container } = render(<HtmlBody {...defaultProps} htmlString={emptyEditorHtml} />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  test("handles complex HTML with attributes", async () => {
    const complexHtml = `
      <div>
        <h1>Title</h1>
        <p><strong>Bold text</strong></p>
        <a href="https://example.com" target="_blank">Link</a>
      </div>
    `;
    const { container } = render(<HtmlBody {...defaultProps} htmlString={complexHtml} />);

    await waitFor(() => {
      const label = container.querySelector("label");
      expect(label).toBeInTheDocument();
      expect(label?.innerHTML).toBe(complexHtml);
    });

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(complexHtml, { ADD_ATTR: ["target"] });
  });

  test("updates content when htmlString prop changes", async () => {
    const initialHtml = "<p>Initial content</p>";
    const { container, rerender } = render(<HtmlBody {...defaultProps} htmlString={initialHtml} />);

    await waitFor(() => {
      const label = container.querySelector("label");
      expect(label?.innerHTML).toBe(initialHtml);
    });

    const updatedHtml = "<p>Updated content</p>";
    rerender(<HtmlBody {...defaultProps} htmlString={updatedHtml} />);

    await waitFor(() => {
      const label = container.querySelector("label");
      expect(label?.innerHTML).toBe(updatedHtml);
    });

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(updatedHtml, { ADD_ATTR: ["target"] });
  });

  test("applies className using cn utility", async () => {
    const htmlString = "<p>Test content</p>";
    const { container } = render(<HtmlBody {...defaultProps} htmlString={htmlString} />);

    await waitFor(() => {
      const label = container.querySelector("label");
      expect(label).toHaveClass("fb-htmlbody", "fb-break-words");
    });
  });
});
