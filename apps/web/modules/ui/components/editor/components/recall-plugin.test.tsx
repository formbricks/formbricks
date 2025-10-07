import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getRecallItems } from "@/lib/utils/recall";
import { $createRecallNode } from "./recall-node";
import { RecallPlugin } from "./recall-plugin";

let mockEditor: any;
let mockEditorState: any;
let mockSelection: any;
let mockTextNode: any;
let mockRoot: any;

const createMockTextNode = (content: string) => ({
  getTextContent: vi.fn(() => content),
  insertBefore: vi.fn(),
  insertAfter: vi.fn(),
  remove: vi.fn(),
  getChildren: vi.fn(() => []),
});

const createMockRecallNode = (recallItem: TSurveyRecallItem, fallbackValue: string) => ({
  getRecallItem: vi.fn(() => recallItem),
  getFallbackValue: vi.fn(() => fallbackValue),
  setFallbackValue: vi.fn(),
  insertBefore: vi.fn(),
  insertAfter: vi.fn(),
  getChildren: vi.fn(() => []),
});

const createMockEditor = () => ({
  update: vi.fn((fn) => fn()),
  registerUpdateListener: vi.fn(() => vi.fn()),
  registerCommand: vi.fn(() => vi.fn()),
  getEditorState: vi.fn(() => mockEditorState),
  getRootElement: vi.fn(() => document.createElement("div")),
});

beforeEach(() => {
  mockTextNode = createMockTextNode("Test text");

  mockRoot = {
    getTextContent: vi.fn(() => "Test text"),
    getChildren: vi.fn(() => [mockTextNode]),
  };

  mockSelection = {
    anchor: {
      offset: 5,
      getNode: vi.fn(() => mockTextNode),
    },
    focus: {
      getNode: vi.fn(() => mockTextNode),
    },
    isCollapsed: vi.fn(() => true),
    insertNodes: vi.fn(),
    setTextNodeRange: vi.fn(),
  };

  mockEditorState = {
    read: vi.fn((fn) => fn()),
  };

  mockEditor = createMockEditor();
});

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn(() => [mockEditor]),
}));

vi.mock("lexical", async () => {
  const actual = await vi.importActual("lexical");
  return {
    ...actual,
    $getRoot: vi.fn(() => mockRoot),
    $getSelection: vi.fn(() => mockSelection),
    $isRangeSelection: vi.fn(() => true),
    $isTextNode: vi.fn((node) => node && node.getTextContent !== undefined),
    $isElementNode: vi.fn((node) => node && node.getChildren !== undefined),
    $createTextNode: vi.fn((text) => createMockTextNode(text)),
    COMMAND_PRIORITY_HIGH: 1,
    KEY_DOWN_COMMAND: "keydown",
  };
});

vi.mock("./recall-node", () => {
  const RecallNodeMock = class {
    __recallItem: TSurveyRecallItem;
    __fallbackValue: string;

    constructor({ recallItem, fallbackValue }: any) {
      this.__recallItem = recallItem;
      this.__fallbackValue = fallbackValue;
    }

    getRecallItem() {
      return this.__recallItem;
    }

    getFallbackValue() {
      return this.__fallbackValue;
    }

    setFallbackValue(value: string) {
      this.__fallbackValue = value;
    }

    getChildren() {
      return [];
    }
  };

  return {
    RecallNode: RecallNodeMock,
    $createRecallNode: vi.fn(
      ({ recallItem, fallbackValue }) => new RecallNodeMock({ recallItem, fallbackValue })
    ),
  };
});

vi.mock("@/lib/utils/recall", () => ({
  getRecallItems: vi.fn((text: string) => {
    if (text.includes("#recall:q1")) {
      return [{ id: "q1", label: "Question 1", type: "question" }];
    }
    return [];
  }),
  getFallbackValues: vi.fn((text: string) => {
    if (text.includes("#recall:q1/fallback:default#")) {
      return { q1: "default" };
    }
    return {};
  }),
}));

vi.mock("@/modules/survey/components/question-form-input/components/recall-item-select", () => ({
  RecallItemSelect: ({ addRecallItem, setShowRecallItemSelect }: any) => (
    <div data-testid="recall-item-select">
      <button
        data-testid="select-recall-item"
        onClick={() => {
          addRecallItem({ id: "q1", label: "Question 1", type: "question" });
        }}>
        Select Item
      </button>
      <button data-testid="close-recall-select" onClick={() => setShowRecallItemSelect(false)}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("@/modules/survey/components/question-form-input/components/fallback-input", () => ({
  FallbackInput: ({ addFallback, setOpen, fallbacks, setFallbacks, filteredRecallItems }: any) => (
    <div data-testid="fallback-input">
      {filteredRecallItems?.map((recallItem: any) => {
        if (!recallItem) return null;
        return (
          <input
            key={recallItem.id}
            data-testid="fallback-input-field"
            value={fallbacks[recallItem.id] || ""}
            onChange={(e) => setFallbacks({ ...fallbacks, [recallItem.id]: e.target.value })}
          />
        );
      })}
      <button data-testid="add-fallback" onClick={addFallback}>
        Add Fallback
      </button>
      <button data-testid="close-fallback" onClick={() => setOpen(false)}>
        Close
      </button>
    </div>
  ),
}));

describe("RecallPlugin", () => {
  const mockSurvey: TSurvey = {
    id: "survey1",
    questions: [
      {
        id: "q1",
        headline: { en: "Question 1" },
        type: "openText",
      },
    ],
    hiddenFields: { fieldIds: [] },
    variables: [],
  } as unknown as TSurvey;

  const defaultProps = {
    localSurvey: mockSurvey,
    questionId: "q1",
    selectedLanguageCode: "en",
    recallItems: [],
    setRecallItems: vi.fn(),
    fallbacks: {},
    setFallbacks: vi.fn(),
    onShowFallbackInput: vi.fn(),
    setAddFallbackFunction: vi.fn(),
    setShowRecallItemSelect: vi.fn(),
    showRecallItemSelect: false,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    test("renders without crashing", () => {
      const { container } = render(<RecallPlugin {...defaultProps} />);
      expect(container).toBeInTheDocument();
    });

    test("does not show RecallItemSelect by default", () => {
      render(<RecallPlugin {...defaultProps} />);
      expect(screen.queryByTestId("recall-item-select")).not.toBeInTheDocument();
    });

    test("does not show FallbackInput when showFallbackInput is false", () => {
      render(<RecallPlugin {...defaultProps} />);
      expect(screen.queryByTestId("fallback-input")).not.toBeInTheDocument();
    });

    test("renders RecallItemSelect when showRecallItemSelect is true", () => {
      render(<RecallPlugin {...defaultProps} showRecallItemSelect={true} />);
      // The RecallItemSelect component should be rendered
      expect(screen.getByTestId("recall-item-select")).toBeInTheDocument();
    });

    test("does not show FallbackInput when recallItems is empty", () => {
      render(<RecallPlugin {...defaultProps} showFallbackInput={true} recallItems={[]} />);
      expect(screen.queryByTestId("fallback-input")).not.toBeInTheDocument();
    });
  });

  describe("Editor Registration", () => {
    test("registers update listener on mount", () => {
      render(<RecallPlugin {...defaultProps} />);
      expect(mockEditor.registerUpdateListener).toHaveBeenCalled();
    });

    test("registers key down command on mount", () => {
      render(<RecallPlugin {...defaultProps} />);
      expect(mockEditor.registerCommand).toHaveBeenCalledWith("keydown", expect.any(Function), 1);
    });

    test("unregisters listeners on unmount", () => {
      const removeUpdateListener = vi.fn();
      const removeKeyListener = vi.fn();
      mockEditor.registerUpdateListener.mockReturnValueOnce(removeUpdateListener);
      mockEditor.registerCommand.mockReturnValueOnce(removeKeyListener);

      const { unmount } = render(<RecallPlugin {...defaultProps} />);
      unmount();

      expect(removeUpdateListener).toHaveBeenCalled();
      expect(removeKeyListener).toHaveBeenCalled();
    });
  });

  describe("Initial Conversion", () => {
    test("runs initial conversion on mount", () => {
      render(<RecallPlugin {...defaultProps} />);
      expect(mockEditor.update).toHaveBeenCalled();
    });

    test("initializes component correctly", () => {
      render(<RecallPlugin {...defaultProps} />);
      expect(mockEditor.registerUpdateListener).toHaveBeenCalled();
    });
  });

  describe("Recall Item Selection", () => {
    test("shows RecallItemSelect when showRecallItemSelect is true", () => {
      render(<RecallPlugin {...defaultProps} showRecallItemSelect={true} />);
      expect(screen.getByTestId("recall-item-select")).toBeInTheDocument();
    });
  });

  describe("Recall Item Addition", () => {
    test("triggers recall item selection when @ key is pressed", async () => {
      const setShowRecallItemSelect = vi.fn();

      render(<RecallPlugin {...defaultProps} setShowRecallItemSelect={setShowRecallItemSelect} />);

      // Trigger the @ key to show modal
      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      mockTextNode = createMockTextNode("@");
      mockSelection.anchor.getNode.mockReturnValue(mockTextNode);
      mockSelection.anchor.offset = 1;

      vi.useFakeTimers();
      keyDownHandler({ key: "@" } as KeyboardEvent);
      vi.advanceTimersByTime(20);
      vi.useRealTimers();

      // Verify that the recall item selection is triggered
      expect(setShowRecallItemSelect).toHaveBeenCalledWith(true);
    });
  });

  describe("Recall Item Selection", () => {
    test("shows RecallItemSelect when showRecallItemSelect is true", () => {
      render(<RecallPlugin {...defaultProps} showRecallItemSelect={true} />);
      expect(screen.getByTestId("recall-item-select")).toBeInTheDocument();
    });
  });

  describe("Editor Update Handling", () => {
    test("handles editor updates with recall patterns", () => {
      const setRecallItems = vi.fn();

      mockRoot.getTextContent.mockReturnValue("Text with #recall:q1/fallback:default#");

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(vi.mocked(getRecallItems)).toHaveBeenCalled();
    });

    test("syncs state when no recall patterns present", () => {
      mockRoot.getTextContent.mockReturnValue("Regular text without recall");

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });
  });

  describe("Text Conversion", () => {
    test("converts recall patterns to RecallNodes", () => {
      mockRoot.getTextContent.mockReturnValue("Text with #recall:q1/fallback:default#");
      mockTextNode.getTextContent.mockReturnValue("Text with #recall:q1/fallback:default#");

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditor.update).toHaveBeenCalled();
    });
  });

  describe("Click Outside Handling", () => {
    test("closes recall item select when clicking outside", async () => {
      const { rerender } = render(<RecallPlugin {...defaultProps} />);

      // Trigger @ key to potentially show modal
      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      mockTextNode = createMockTextNode("@");
      mockSelection.anchor.getNode.mockReturnValue(mockTextNode);
      mockSelection.anchor.offset = 1;

      vi.useFakeTimers();
      keyDownHandler({ key: "@" } as KeyboardEvent);
      vi.advanceTimersByTime(20);
      vi.useRealTimers();

      // Simulate click outside
      const clickEvent = new MouseEvent("mousedown", { bubbles: true });
      document.dispatchEvent(clickEvent);

      rerender(<RecallPlugin {...defaultProps} />);
    });
  });

  describe("State Synchronization", () => {
    test("syncs recall items from editor content", () => {
      const setRecallItems = vi.fn();
      const recallNode = createMockRecallNode({ id: "q1", label: "Question 1", type: "question" }, "default");

      mockRoot.getChildren.mockReturnValue([recallNode]);

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });
    });
  });

  describe("Fallback Value Updates", () => {
    test("handles recall node creation", () => {
      const recallItems: TSurveyRecallItem[] = [{ id: "q1", label: "Question 1", type: "question" }];
      const recallNode = $createRecallNode({
        recallItem: recallItems[0],
        fallbackValue: "",
      });

      expect(recallNode).toBeDefined();
      expect(recallNode.getRecallItem()).toEqual(recallItems[0]);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty survey", () => {
      const emptySurvey = {
        ...mockSurvey,
        questions: [],
      };

      const { container } = render(<RecallPlugin {...defaultProps} localSurvey={emptySurvey} />);
      expect(container).toBeInTheDocument();
    });

    test("handles missing hiddenFields", () => {
      const surveyWithoutHiddenFields = {
        ...mockSurvey,
        hiddenFields: undefined,
      } as any;

      const { container } = render(
        <RecallPlugin {...defaultProps} localSurvey={surveyWithoutHiddenFields} />
      );
      expect(container).toBeInTheDocument();
    });

    test("handles keyboard events for non-@ keys", () => {
      render(<RecallPlugin {...defaultProps} />);

      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      const result = keyDownHandler({ key: "a" } as KeyboardEvent);

      expect(result).toBe(false);
    });

    test("handles selection that is not a text node", () => {
      render(<RecallPlugin {...defaultProps} />);

      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      const elementNode = { getChildren: vi.fn(() => []) };
      mockSelection.anchor.getNode.mockReturnValue(elementNode);

      vi.useFakeTimers();
      keyDownHandler({ key: "@" } as KeyboardEvent);
      vi.advanceTimersByTime(20);
      vi.useRealTimers();
    });

    test("handles nodes with children correctly", () => {
      const childNode = createMockTextNode("child text");
      const parentNode = {
        getChildren: vi.fn(() => [childNode]),
        getTextContent: vi.fn(() => "parent text"),
      };

      mockRoot.getChildren.mockReturnValue([parentNode]);

      render(<RecallPlugin {...defaultProps} />);

      expect(mockEditor.registerUpdateListener).toHaveBeenCalled();
    });

    test("handles errors during node traversal gracefully", () => {
      const errorNode = {
        getChildren: vi.fn(() => {
          throw new Error("Test error");
        }),
      };

      mockRoot.getChildren.mockReturnValue([errorNode]);

      const { container } = render(<RecallPlugin {...defaultProps} />);
      expect(container).toBeInTheDocument();
    });
  });

  describe("Multiple Language Support", () => {
    test("uses selected language code for recall items", () => {
      mockRoot.getTextContent.mockReturnValue("Text with #recall:q1/fallback:default#");

      render(<RecallPlugin {...defaultProps} selectedLanguageCode="es" />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(vi.mocked(getRecallItems)).toHaveBeenCalledWith(expect.any(String), expect.any(Object), "es");
    });
  });
});
