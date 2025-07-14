import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WebsiteEmbedTab } from "./website-embed-tab";

// Mock components
vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: (props: {
    htmlId: string;
    isChecked: boolean;
    onToggle: (checked: boolean) => void;
    title: string;
    description: string;
    customContainerClass?: string;
  }) => (
    <div data-testid="advanced-option-toggle">
      <label htmlFor={props.htmlId}>{props.title}</label>
      <input
        id={props.htmlId}
        type="checkbox"
        checked={props.isChecked}
        onChange={(e) => props.onToggle(e.target.checked)}
        data-testid="embed-mode-toggle"
      />
      <span>{props.description}</span>
      {props.customContainerClass && (
        <span data-testid="custom-container-class">{props.customContainerClass}</span>
      )}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: (props: {
    title?: string;
    "aria-label"?: string;
    onClick?: () => void;
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
  }) => (
    <button
      title={props.title}
      aria-label={props["aria-label"]}
      onClick={props.onClick}
      data-testid="copy-button"
      type={props.type}>
      {props.children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/code-block", () => ({
  CodeBlock: (props: {
    language: string;
    showCopyToClipboard: boolean;
    noMargin?: boolean;
    children: string;
  }) => (
    <div data-testid="code-block">
      <span data-testid="language">{props.language}</span>
      <span data-testid="show-copy">{props.showCopyToClipboard?.toString() || "false"}</span>
      {props.noMargin && <span data-testid="no-margin">true</span>}
      <pre>{props.children}</pre>
    </div>
  ),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("lucide-react", () => ({
  CopyIcon: () => <div data-testid="copy-icon">CopyIcon</div>,
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

describe("WebsiteEmbedTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    surveyUrl: "https://example.com/survey/123",
  };

  test("renders all components correctly", () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    expect(screen.getByTestId("code-block")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-option-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
  });

  test("renders correct iframe code without embed mode", () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock).toBeInTheDocument();

    const code = codeBlock.querySelector("pre")?.textContent;
    expect(code).toContain(defaultProps.surveyUrl);
    expect(code).toContain("<iframe");
    expect(code).toContain('src="https://example.com/survey/123"');
    expect(code).not.toContain("?embed=true");
  });

  test("renders correct iframe code with embed mode enabled", async () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    const toggle = screen.getByTestId("embed-mode-toggle");
    await userEvent.click(toggle);

    const codeBlock = screen.getByTestId("code-block");
    const code = codeBlock.querySelector("pre")?.textContent;
    expect(code).toContain('src="https://example.com/survey/123?embed=true"');
  });

  test("toggle changes embed mode state", async () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    const toggle = screen.getByTestId("embed-mode-toggle");
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  test("copy button copies iframe code to clipboard", async () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    const copyButton = screen.getByTestId("copy-button");
    await userEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(defaultProps.surveyUrl)
    );
    const toast = await import("react-hot-toast");
    expect(toast.default.success).toHaveBeenCalledWith(
      "environments.surveys.share.embed_on_website.embed_code_copied_to_clipboard"
    );
  });

  test("copy button copies correct code with embed mode enabled", async () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    const toggle = screen.getByTestId("embed-mode-toggle");
    await userEvent.click(toggle);

    const copyButton = screen.getByTestId("copy-button");
    await userEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("?embed=true"));
  });

  test("renders code block with correct props", () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    expect(screen.getByTestId("language")).toHaveTextContent("html");
    expect(screen.getByTestId("show-copy")).toHaveTextContent("false");
    expect(screen.getByTestId("no-margin")).toBeInTheDocument();
  });

  test("renders advanced option toggle with correct props", () => {
    render(<WebsiteEmbedTab {...defaultProps} />);

    const toggle = screen.getByTestId("advanced-option-toggle");
    expect(toggle).toHaveTextContent("environments.surveys.share.embed_on_website.embed_mode");
    expect(toggle).toHaveTextContent("environments.surveys.share.embed_on_website.embed_mode_description");
    expect(screen.getByTestId("custom-container-class")).toHaveTextContent("p-0");
  });
});
