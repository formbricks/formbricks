import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Prism from "prismjs";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CodeBlock } from "./index";

// Import toast

// Mock Prism.js
vi.mock("prismjs", () => ({
  default: {
    highlightAll: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-hot-toast")>();
  return {
    ...actual,
    default: {
      success: vi.fn(), // Mock toast.success directly here
    },
  };
});

describe("CodeBlock", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks(); // Reset mocks to avoid interference between tests
  });

  test("renders children and applies language class", () => {
    const codeSnippet = "const greeting = 'Hello, world!';";
    const language = "javascript";
    render(<CodeBlock language={language}>{codeSnippet}</CodeBlock>);

    const codeElement = screen.getByText(codeSnippet);
    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveClass(`language-${language}`);
  });

  test("calls Prism.highlightAll on render and when children change", () => {
    const codeSnippet = "const greeting = 'Hello, world!';";
    const language = "javascript";
    const { rerender } = render(<CodeBlock language={language}>{codeSnippet}</CodeBlock>);
    expect(Prism.highlightAll).toHaveBeenCalledTimes(1);

    const newCodeSnippet = "const newGreeting = 'Hello, Vitest!';";
    rerender(<CodeBlock language={language}>{newCodeSnippet}</CodeBlock>);
    expect(Prism.highlightAll).toHaveBeenCalledTimes(2);
  });

  test("copies code to clipboard when copy icon is clicked", async () => {
    const user = userEvent.setup();
    const codeSnippet = "console.log('Copy me!');";
    const language = "typescript";
    render(<CodeBlock language={language}>{codeSnippet}</CodeBlock>);

    // Store the original clipboard
    const originalClipboard = navigator.clipboard;
    // Mock clipboard API for this test
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true, // Allow redefining for cleanup
    });

    // Find the copy icon by its role and accessible name (if any) or by a more robust selector
    // If the icon itself doesn't have a role or accessible name, find its container
    const copyButtonContainer = screen.getByTestId("copy-icon"); // Assuming the button or its container has an accessible name like "Copy to clipboard"
    expect(copyButtonContainer).toBeInTheDocument();

    await user.click(copyButtonContainer);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(codeSnippet);
    // Use the imported toast for assertion
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("common.copied_to_clipboard");

    // Restore the original clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
    });
  });

  test("does not show copy to clipboard button when showCopyToClipboard is false", () => {
    const codeSnippet = "const secret = 'Do not copy!';";
    const language = "text";
    render(
      <CodeBlock language={language} showCopyToClipboard={false}>
        {codeSnippet}
      </CodeBlock>
    );
    // Check if the copy button is not present
    const copyButton = screen.queryByTestId("copy-icon");
    expect(copyButton).not.toBeInTheDocument();
  });

  test("applies custom editor and code classes", () => {
    const codeSnippet = "<p>Custom classes</p>";
    const language = "html";
    const customEditorClass = "custom-editor";
    const customCodeClass = "custom-code";
    render(
      <CodeBlock language={language} customEditorClass={customEditorClass} customCodeClass={customCodeClass}>
        {codeSnippet}
      </CodeBlock>
    );

    const preElement = screen.getByText(codeSnippet).closest("pre");
    expect(preElement).toHaveClass(customEditorClass);

    const codeElement = screen.getByText(codeSnippet);
    expect(codeElement).toHaveClass(`language-${language}`);
    expect(codeElement).toHaveClass(customCodeClass);
  });

  test("applies no margin class when noMargin is true", () => {
    const codeSnippet = "const test = 'no margin';";
    const language = "javascript";
    render(
      <CodeBlock language={language} noMargin>
        {codeSnippet}
      </CodeBlock>
    );

    const containerElement = screen.getByText(codeSnippet).closest("div");
    expect(containerElement).not.toHaveClass("mt-4");
  });

  test("applies default margin class when noMargin is false", () => {
    const codeSnippet = "const test = 'with margin';";
    const language = "javascript";
    render(
      <CodeBlock language={language} noMargin={false}>
        {codeSnippet}
      </CodeBlock>
    );

    const containerElement = screen.getByText(codeSnippet).closest("div");
    expect(containerElement).toHaveClass("mt-4");
  });

  test("applies default margin class when noMargin is undefined", () => {
    const codeSnippet = "const test = 'default margin';";
    const language = "javascript";
    render(<CodeBlock language={language}>{codeSnippet}</CodeBlock>);

    const containerElement = screen.getByText(codeSnippet).closest("div");
    expect(containerElement).toHaveClass("mt-4");
  });
});
