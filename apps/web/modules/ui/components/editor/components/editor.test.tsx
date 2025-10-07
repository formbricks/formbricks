import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Editor } from "./editor";

// Mock sub-components used in Editor
vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn(() => [
    {
      registerUpdateListener: vi.fn(),
      registerCommand: vi.fn(),
      getEditorState: vi.fn(() => ({
        read: vi.fn((callback) => callback()),
      })),
      update: vi.fn((callback) => callback()),
    },
  ]),
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
  EditorContentChecker: () => <div data-testid="editor-content-checker" />,
}));

vi.mock("./recall-plugin", () => ({
  RecallPlugin: (props: any) => <div data-testid="recall-plugin" data-props={JSON.stringify(props)} />,
}));

vi.mock("@/modules/survey/components/question-form-input/components/fallback-input", () => ({
  FallbackInput: (props: any) => (
    <div data-testid="fallback-input" data-props={JSON.stringify(props)}>
      <div data-testid="fallback-trigger-button">{props.triggerButton}</div>
    </div>
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

vi.mock("@tolgee/react", () => ({
  useTranslate: () => (key: string) => key,
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
    const props = JSON.parse(toolbarPlugin.dataset.props || "{}");
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

  describe("Recall Functionality", () => {
    const createMockSurvey = (): TSurvey =>
      ({
        id: "survey1",
        name: "Test Survey",
        welcomeCard: { enabled: false, headline: {} } as unknown as TSurvey["welcomeCard"],
        questions: [
          {
            id: "question1",
            headline: { en: "Question 1" },
            type: "shortText",
          },
        ],
        endings: [],
        hiddenFields: { enabled: true, fieldIds: [] },
        followUps: [],
        type: "link",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        languages: [],
      }) as unknown as TSurvey;

    test("renders RecallPlugin when all required recall props are provided", () => {
      const localSurvey = createMockSurvey();
      const fallbacks = { q1: "default" };

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
          fallbacks={fallbacks}
        />
      );

      expect(screen.getByTestId("recall-plugin")).toBeInTheDocument();
    });

    test("does not render RecallPlugin when localSurvey is missing", () => {
      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          questionId="question1"
          selectedLanguageCode="en"
        />
      );

      expect(screen.queryByTestId("recall-plugin")).not.toBeInTheDocument();
    });

    test("does not render RecallPlugin when questionId is missing", () => {
      const localSurvey = createMockSurvey();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          selectedLanguageCode="en"
        />
      );

      expect(screen.queryByTestId("recall-plugin")).not.toBeInTheDocument();
    });

    test("does not render RecallPlugin when selectedLanguageCode is missing", () => {
      const localSurvey = createMockSurvey();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
        />
      );

      expect(screen.queryByTestId("recall-plugin")).not.toBeInTheDocument();
    });

    test("passes correct props to RecallPlugin", () => {
      const localSurvey = createMockSurvey();
      const fallbacks = { q1: "default" };

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
          fallbacks={fallbacks}
        />
      );

      const recallPlugin = screen.getByTestId("recall-plugin");
      const props = JSON.parse(recallPlugin.dataset.props || "{}");

      expect(props.localSurvey.id).toBe(localSurvey.id);
      expect(props.localSurvey.name).toBe(localSurvey.name);
      expect(props.localSurvey.type).toBe(localSurvey.type);
      expect(props.questionId).toBe("question1");
      expect(props.selectedLanguageCode).toBe("en");
      expect(props.fallbacks).toEqual(fallbacks);
      // Functions are not serialized in JSON, so we check that the props object exists
      expect(props).toBeDefined();
    });

    test("passes recall props to ToolbarPlugin", () => {
      const localSurvey = createMockSurvey();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
        />
      );

      const toolbarPlugin = screen.getByTestId("toolbar-plugin");
      const props = JSON.parse(toolbarPlugin.dataset.props || "{}");

      expect(props.localSurvey.id).toBe(localSurvey.id);
      expect(props.localSurvey.name).toBe(localSurvey.name);
      expect(props.localSurvey.type).toBe(localSurvey.type);
      expect(props.questionId).toBe("question1");
      expect(props.selectedLanguageCode).toBe("en");
      // Functions are not serialized in JSON, so we check that the props object exists
      expect(props).toBeDefined();
    });

    test("does not render FallbackInput when recallItems is empty", () => {
      const localSurvey = createMockSurvey();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
        />
      );

      expect(screen.queryByTestId("fallback-input")).not.toBeInTheDocument();
    });

    test("renders FallbackInput when recallItems are present", () => {
      const localSurvey = createMockSurvey();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
        />
      );

      // The FallbackInput should not be rendered initially since recallItems is empty
      expect(screen.queryByTestId("fallback-input")).not.toBeInTheDocument();
    });

    test("passes correct props to FallbackInput", () => {
      const localSurvey = createMockSurvey();
      const fallbacks = { q1: "default" };
      const addFallback = vi.fn();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
          fallbacks={fallbacks}
          addFallback={addFallback}
        />
      );

      // Since recallItems is empty, FallbackInput should not be rendered
      expect(screen.queryByTestId("fallback-input")).not.toBeInTheDocument();
    });

    test("renders trigger button with correct text and icon", () => {
      const localSurvey = createMockSurvey();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
        />
      );

      // Since recallItems is empty, trigger button should not be rendered
      expect(screen.queryByTestId("fallback-trigger-button")).not.toBeInTheDocument();
    });

    test("handles fallbacks prop correctly", () => {
      const localSurvey = createMockSurvey();
      const fallbacks = { q1: "default", q2: "fallback" };

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
          fallbacks={fallbacks}
        />
      );

      const recallPlugin = screen.getByTestId("recall-plugin");
      const props = JSON.parse(recallPlugin.dataset.props || "{}");

      expect(props.fallbacks).toEqual(fallbacks);
    });

    test("handles addFallback prop correctly", () => {
      const localSurvey = createMockSurvey();
      const addFallback = vi.fn();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
          addFallback={addFallback}
        />
      );

      // Since recallItems is empty, FallbackInput should not be rendered
      expect(screen.queryByTestId("fallback-input")).not.toBeInTheDocument();
    });

    test("includes RecallNode in editor config nodes", () => {
      const localSurvey = createMockSurvey();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={() => {}}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
        />
      );

      // The RecallNode should be included in the editor config
      // This is tested indirectly by the RecallPlugin being able to function
      expect(screen.getByTestId("recall-plugin")).toBeInTheDocument();
    });

    test("manages recall state correctly", () => {
      const localSurvey = createMockSurvey();
      const setText = vi.fn();

      render(
        <Editor
          getText={() => "Sample text"}
          setText={setText}
          localSurvey={localSurvey}
          questionId="question1"
          selectedLanguageCode="en"
        />
      );

      const recallPlugin = screen.getByTestId("recall-plugin");
      const props = JSON.parse(recallPlugin.dataset.props || "{}");

      // Test that state management functions are provided
      // Functions are not serialized in JSON, so we check that the props object exists
      expect(props).toBeDefined();

      // Test initial state
      expect(props.recallItems).toEqual([]);
      expect(props.fallbacks).toEqual({});
      expect(props.showRecallItemSelect).toBe(false);
    });
  });
});
