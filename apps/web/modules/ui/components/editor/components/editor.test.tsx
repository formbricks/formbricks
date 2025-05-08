import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Editor } from "./editor";

// Mock sub-components used in Editor
vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn(() => [{ registerUpdateListener: vi.fn() }]),
}));

vi.mock("@lexical/react/LexicalRichTextPlugin", () => ({
  RichTextPlugin: ({ contentEditable, placeholder, ErrorBoundary }) => (
    <div data-testid="rich-text-plugin">
      {contentEditable}
      {placeholder}
      <ErrorBoundary>Error Content</ErrorBoundary>
    </div>
  ),
}));

vi.mock("@lexical/react/LexicalContentEditable", () => ({
  ContentEditable: (props: any) => <div data-testid="content-editable" {...props} />,
}));

vi.mock("@lexical/react/LexicalErrorBoundary", () => ({
  LexicalErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

vi.mock("@lexical/react/LexicalListPlugin", () => ({
  ListPlugin: () => <div data-testid="list-plugin" />,
}));

vi.mock("@lexical/react/LexicalLinkPlugin", () => ({
  LinkPlugin: () => <div data-testid="link-plugin" />,
}));

vi.mock("@lexical/react/LexicalMarkdownShortcutPlugin", () => ({
  MarkdownShortcutPlugin: ({ transformers }) => (
    <div data-testid="markdown-plugin" data-transformers-count={transformers?.length} />
  ),
}));

vi.mock("./toolbar-plugin", () => ({
  ToolbarPlugin: (props: any) => <div data-testid="toolbar-plugin" data-props={JSON.stringify(props)} />,
}));

vi.mock("./auto-link-plugin", () => ({
  PlaygroundAutoLinkPlugin: () => <div data-testid="auto-link-plugin" />,
}));

vi.mock("./editor-content-checker", () => ({
  EditorContentChecker: ({ onEmptyChange }: { onEmptyChange: (isEmpty: boolean) => void }) => (
    <div data-testid="editor-content-checker" />
  ),
}));

// Fix the mock to correctly set the className for isInvalid
vi.mock("@lexical/react/LexicalComposer", () => ({
  LexicalComposer: ({ children, initialConfig }: { children: React.ReactNode; initialConfig: any }) => {
    // Use the isInvalid property to set the class name correctly
    const className = initialConfig.theme?.isInvalid ? "!border !border-red-500" : "";
    return (
      <div data-testid="lexical-composer" data-editable={initialConfig.editable}>
        <div data-testid="editor-container" className={className}>
          {children}
        </div>
      </div>
    );
  },
}));

vi.mock("@/lib/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("Editor", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the editor with default props", () => {
    render(<Editor getText={() => "Sample text"} setText={() => {}} />);

    // Check if the main components are rendered
    expect(screen.getByTestId("lexical-composer")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-plugin")).toBeInTheDocument();
    expect(screen.getByTestId("rich-text-plugin")).toBeInTheDocument();
    expect(screen.getByTestId("list-plugin")).toBeInTheDocument();
    expect(screen.getByTestId("link-plugin")).toBeInTheDocument();
    expect(screen.getByTestId("auto-link-plugin")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-plugin")).toBeInTheDocument();

    // Editor should be editable by default
    expect(screen.getByTestId("lexical-composer")).toHaveAttribute("data-editable", "true");
  });

  test("renders the editor with custom height", () => {
    render(<Editor getText={() => "Sample text"} setText={() => {}} height="200px" />);

    // Content editable should have the style height set
    expect(screen.getByTestId("content-editable")).toHaveStyle({ height: "200px" });
  });

  test("passes variables to toolbar plugin", () => {
    const variables = ["name", "email"];
    render(<Editor getText={() => "Sample text"} setText={() => {}} variables={variables} />);

    const toolbarPlugin = screen.getByTestId("toolbar-plugin");
    const props = JSON.parse(toolbarPlugin.getAttribute("data-props") || "{}");
    expect(props.variables).toEqual(variables);
  });

  test("renders not editable when editable is false", () => {
    render(<Editor getText={() => "Sample text"} setText={() => {}} editable={false} />);

    expect(screen.getByTestId("lexical-composer")).toHaveAttribute("data-editable", "false");
  });

  test("includes editor content checker when onEmptyChange is provided", () => {
    const onEmptyChange = vi.fn();
    render(<Editor getText={() => "Sample text"} setText={() => {}} onEmptyChange={onEmptyChange} />);

    expect(screen.getByTestId("editor-content-checker")).toBeInTheDocument();
  });

  test("disables list properly when disableLists is true", () => {
    render(<Editor getText={() => "Sample text"} setText={() => {}} disableLists={true} />);

    const markdownPlugin = screen.getByTestId("markdown-plugin");
    // Should have filtered out two list transformers
    expect(markdownPlugin).not.toHaveAttribute("data-transformers-count", "7");
  });
});
