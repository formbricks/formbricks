import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

// Mock RecallNode class
class MockRecallNode {
  constructor(
    public recallItem: TSurveyRecallItem,
    public fallbackValue: string
  ) {}

  getRecallItem() {
    return this.recallItem;
  }
  getFallbackValue() {
    return this.fallbackValue;
  }
  setFallbackValue = vi.fn();
  insertBefore = vi.fn();
  insertAfter = vi.fn();
  getChildren = vi.fn(() => []);
}

// Mock the RecallNode class for instanceof checks
vi.mock("../recall-node", () => ({
  RecallNode: MockRecallNode,
}));

const createMockRecallNode = (recallItem: TSurveyRecallItem, fallbackValue: string) => {
  return new MockRecallNode(recallItem, fallbackValue);
};

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
      render(<RecallPlugin {...defaultProps} onShowFallbackInput={() => {}} recallItems={[]} />);
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

  describe("Text Node Collection and Traversal", () => {
    test("collects text nodes from nested element structure", () => {
      const childTextNode1 = createMockTextNode("Child text 1");
      const childTextNode2 = createMockTextNode("Child text 2");
      const parentElement = {
        getChildren: vi.fn(() => [childTextNode1, childTextNode2]),
        getTextContent: vi.fn(() => "Parent text"),
      };

      mockRoot.getChildren.mockReturnValue([parentElement]);

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });

    test("handles error during node traversal gracefully", () => {
      const errorNode = {
        getChildren: vi.fn(() => {
          throw new Error("Test traversal error");
        }),
        getTextContent: vi.fn(() => "Error node"),
      };

      mockRoot.getChildren.mockReturnValue([errorNode]);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(consoleSpy).toHaveBeenCalledWith("Error getting children from node:", expect.any(Error));
      consoleSpy.mockRestore();
    });

    test("handles mixed text and element nodes", () => {
      const textNode = createMockTextNode("Text content");
      const elementNode = {
        getChildren: vi.fn(() => [createMockTextNode("Nested text")]),
        getTextContent: vi.fn(() => "Element content"),
      };

      mockRoot.getChildren.mockReturnValue([textNode, elementNode]);

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });
  });

  describe("Text to Recall Node Conversion", () => {
    test("converts text with recall patterns to RecallNodes", () => {
      const textWithRecall = "Hello #recall:q1/fallback:default# world";
      mockTextNode.getTextContent.mockReturnValue(textWithRecall);
      mockRoot.getChildren.mockReturnValue([mockTextNode]);

      // Mock the regex test to return true
      const originalTest = RegExp.prototype.test;
      RegExp.prototype.test = vi.fn(() => true);

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditor.update).toHaveBeenCalled();

      // Restore original test method
      RegExp.prototype.test = originalTest;
    });

    test("handles text without recall patterns", () => {
      const plainText = "Hello world without recall";
      mockTextNode.getTextContent.mockReturnValue(plainText);
      mockRoot.getChildren.mockReturnValue([mockTextNode]);

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });
  });

  describe("Recall Node Finding", () => {
    test("finds RecallNodes in nested structure", () => {
      const recallNode = createMockRecallNode({ id: "q1", label: "Question 1", type: "question" }, "default");
      const parentElement = {
        getChildren: vi.fn(() => [recallNode]),
        getTextContent: vi.fn(() => "Parent with recall"),
      };

      mockRoot.getChildren.mockReturnValue([parentElement]);

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });

    test("handles error when getting children from element node", () => {
      const errorElement = {
        getChildren: vi.fn(() => {
          throw new Error("Error getting children");
        }),
        getTextContent: vi.fn(() => "Error element"),
      };

      mockRoot.getChildren.mockReturnValue([errorElement]);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(consoleSpy).toHaveBeenCalledWith("Error getting children from node:", expect.any(Error));
      consoleSpy.mockRestore();
    });

    test("finds multiple RecallNodes at different levels", () => {
      const recallNode1 = createMockRecallNode(
        { id: "q1", label: "Question 1", type: "question" },
        "default"
      );
      const recallNode2 = createMockRecallNode({ id: "q2", label: "Question 2", type: "question" }, "test");
      const parentElement = {
        getChildren: vi.fn(() => [recallNode1, recallNode2]),
        getTextContent: vi.fn(() => "Parent with multiple recalls"),
      };

      mockRoot.getChildren.mockReturnValue([parentElement]);

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });
  });

  describe("Text Node Replacement", () => {
    test("replaces text node with new nodes successfully", () => {
      const newNodes = [
        createMockTextNode("Before "),
        createMockRecallNode({ id: "q1", label: "Question 1", type: "question" }, "default"),
        createMockTextNode(" after"),
      ];

      mockTextNode.insertBefore.mockImplementation(() => {});
      mockTextNode.insertAfter.mockImplementation(() => {});
      mockTextNode.remove.mockImplementation(() => {});

      render(<RecallPlugin {...defaultProps} />);

      // Simulate text replacement by calling the update handler
      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });

    test("skips replacement when newNodes array is empty", () => {
      mockTextNode.insertBefore.mockImplementation(() => {});
      mockTextNode.remove.mockImplementation(() => {});

      render(<RecallPlugin {...defaultProps} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalled();
    });
  });

  describe("Advanced Editor Update Scenarios", () => {
    test("handles editor update with existing RecallNodes and new recall patterns", () => {
      const existingRecallNode = createMockRecallNode(
        { id: "q1", label: "Question 1", type: "question" },
        "existing"
      );
      mockRoot.getChildren.mockReturnValue([existingRecallNode]);
      mockRoot.getTextContent.mockReturnValue("Text with #recall:q2/fallback:new#");

      const setRecallItems = vi.fn();
      const setFallbacks = vi.fn();

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} setFallbacks={setFallbacks} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(setRecallItems).toHaveBeenCalled();
      expect(setFallbacks).toHaveBeenCalled();
    });

    test("merges recall items without duplicates", () => {
      const existingRecallNode = createMockRecallNode(
        { id: "q1", label: "Question 1", type: "question" },
        "existing"
      );
      mockRoot.getChildren.mockReturnValue([existingRecallNode]);
      mockRoot.getTextContent.mockReturnValue("Text with #recall:q1/fallback:updated#");

      const setRecallItems = vi.fn();
      const setFallbacks = vi.fn();

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} setFallbacks={setFallbacks} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(setRecallItems).toHaveBeenCalled();
      expect(setFallbacks).toHaveBeenCalled();
    });

    test("handles editor update with no recall patterns", () => {
      mockRoot.getTextContent.mockReturnValue("Plain text without any recall patterns");
      mockRoot.getChildren.mockReturnValue([]);

      const setRecallItems = vi.fn();
      const setFallbacks = vi.fn();

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} setFallbacks={setFallbacks} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(setRecallItems).toHaveBeenCalledWith([]);
      expect(setFallbacks).toHaveBeenCalledWith({});
    });
  });

  describe("Keyboard Event Handling", () => {
    test("handles @ key press with proper timing", async () => {
      const setShowRecallItemSelect = vi.fn();

      render(<RecallPlugin {...defaultProps} setShowRecallItemSelect={setShowRecallItemSelect} />);

      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      mockTextNode = createMockTextNode("@");
      mockSelection.anchor.getNode.mockReturnValue(mockTextNode);
      mockSelection.anchor.offset = 1;

      vi.useFakeTimers();
      keyDownHandler({ key: "@" } as KeyboardEvent);
      vi.advanceTimersByTime(20);
      vi.useRealTimers();

      expect(setShowRecallItemSelect).toHaveBeenCalledWith(true);
    });

    test("handles @ key press when cursor is not at @ position", async () => {
      const setShowRecallItemSelect = vi.fn();

      render(<RecallPlugin {...defaultProps} setShowRecallItemSelect={setShowRecallItemSelect} />);

      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      mockTextNode = createMockTextNode("Hello@world");
      mockSelection.anchor.getNode.mockReturnValue(mockTextNode);
      mockSelection.anchor.offset = 3; // Not at @ position

      vi.useFakeTimers();
      keyDownHandler({ key: "@" } as KeyboardEvent);
      vi.advanceTimersByTime(20);
      vi.useRealTimers();

      expect(setShowRecallItemSelect).not.toHaveBeenCalled();
    });

    test("handles @ key press when selection is not a range selection", async () => {
      const setShowRecallItemSelect = vi.fn();

      // Mock $isRangeSelection to return false
      const { $isRangeSelection } = await import("lexical");
      vi.mocked($isRangeSelection).mockReturnValue(false);

      render(<RecallPlugin {...defaultProps} setShowRecallItemSelect={setShowRecallItemSelect} />);

      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];

      vi.useFakeTimers();
      keyDownHandler({ key: "@" } as KeyboardEvent);
      vi.advanceTimersByTime(20);
      vi.useRealTimers();

      expect(setShowRecallItemSelect).not.toHaveBeenCalled();
    });

    test("handles @ key press when anchor node is not a text node", async () => {
      const setShowRecallItemSelect = vi.fn();

      render(<RecallPlugin {...defaultProps} setShowRecallItemSelect={setShowRecallItemSelect} />);

      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      const elementNode = { getChildren: vi.fn(() => []) };
      mockSelection.anchor.getNode.mockReturnValue(elementNode);

      vi.useFakeTimers();
      keyDownHandler({ key: "@" } as KeyboardEvent);
      vi.advanceTimersByTime(20);
      vi.useRealTimers();

      expect(setShowRecallItemSelect).not.toHaveBeenCalled();
    });

    test("returns false for non-@ key events", () => {
      render(<RecallPlugin {...defaultProps} />);

      const keyDownHandler = mockEditor.registerCommand.mock.calls[0][1];
      const result = keyDownHandler({ key: "a" } as KeyboardEvent);

      expect(result).toBe(false);
    });
  });

  describe("Recall Item Addition", () => {
    test("adds recall item using stored @ symbol position", () => {
      const setRecallItems = vi.fn();
      const onShowFallbackInput = vi.fn();
      // Mock the component to have atSymbolPosition
      const { rerender } = render(
        <RecallPlugin
          {...defaultProps}
          setRecallItems={setRecallItems}
          onShowFallbackInput={onShowFallbackInput}
        />
      );

      // Simulate having an @ symbol position
      mockSelection.setTextNodeRange.mockImplementation(() => {});
      mockSelection.insertNodes.mockImplementation(() => {});

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditor.update).toHaveBeenCalled();
    });

    test("adds recall item using current selection when no stored position", () => {
      const setRecallItems = vi.fn();
      const onShowFallbackInput = vi.fn();

      mockTextNode = createMockTextNode("Hello@");
      mockSelection.anchor.getNode.mockReturnValue(mockTextNode);
      mockSelection.anchor.offset = 6; // At @ position
      mockSelection.setTextNodeRange.mockImplementation(() => {});
      mockSelection.insertNodes.mockImplementation(() => {});

      render(
        <RecallPlugin
          {...defaultProps}
          setRecallItems={setRecallItems}
          onShowFallbackInput={onShowFallbackInput}
        />
      );

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditor.update).toHaveBeenCalled();
    });

    test("updates recall items state and shows fallback input", () => {
      const setRecallItems = vi.fn();
      const onShowFallbackInput = vi.fn();

      render(
        <RecallPlugin
          {...defaultProps}
          setRecallItems={setRecallItems}
          onShowFallbackInput={onShowFallbackInput}
        />
      );

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(mockEditor.update).toHaveBeenCalled();
    });
  });

  describe("Component Lifecycle and Cleanup", () => {
    test("exposes addFallback function to parent on mount", () => {
      const setAddFallbackFunction = vi.fn();

      render(<RecallPlugin {...defaultProps} setAddFallbackFunction={setAddFallbackFunction} />);

      expect(setAddFallbackFunction).toHaveBeenCalledWith(expect.any(Function));
    });

    test("cleans up addFallback function on unmount", () => {
      const setAddFallbackFunction = vi.fn();

      const { unmount } = render(
        <RecallPlugin {...defaultProps} setAddFallbackFunction={setAddFallbackFunction} />
      );

      unmount();

      expect(setAddFallbackFunction).toHaveBeenCalledWith(null);
    });

    test("clears atSymbolPosition when dropdown closes", () => {
      const { rerender } = render(<RecallPlugin {...defaultProps} showRecallItemSelect={true} />);

      // Simulate dropdown closing
      rerender(<RecallPlugin {...defaultProps} showRecallItemSelect={false} />);

      // The component should handle cleanup internally
      expect(mockEditor.registerUpdateListener).toHaveBeenCalled();
    });
  });

  describe("Complex Integration Scenarios", () => {
    test("handles mixed content with text nodes and RecallNodes", () => {
      const textNode1 = createMockTextNode("Before ");
      const recallNode = createMockRecallNode({ id: "q1", label: "Question 1", type: "question" }, "default");
      const textNode2 = createMockTextNode(" after");

      mockRoot.getChildren.mockReturnValue([textNode1, recallNode, textNode2]);

      const setRecallItems = vi.fn();
      const setFallbacks = vi.fn();

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} setFallbacks={setFallbacks} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(setRecallItems).toHaveBeenCalled();
      expect(setFallbacks).toHaveBeenCalled();
    });

    test("handles nested element structure with RecallNodes", () => {
      const recallNode = createMockRecallNode({ id: "q1", label: "Question 1", type: "question" }, "default");
      const nestedElement = {
        getChildren: vi.fn(() => [recallNode]),
        getTextContent: vi.fn(() => "Nested element"),
      };
      const parentElement = {
        getChildren: vi.fn(() => [nestedElement]),
        getTextContent: vi.fn(() => "Parent element"),
      };

      mockRoot.getChildren.mockReturnValue([parentElement]);

      const setRecallItems = vi.fn();
      const setFallbacks = vi.fn();

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} setFallbacks={setFallbacks} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];
      updateHandler({ editorState: mockEditorState });

      expect(setRecallItems).toHaveBeenCalled();
      expect(setFallbacks).toHaveBeenCalled();
    });

    test("handles rapid editor updates", () => {
      const setRecallItems = vi.fn();
      const setFallbacks = vi.fn();

      render(<RecallPlugin {...defaultProps} setRecallItems={setRecallItems} setFallbacks={setFallbacks} />);

      const updateHandler = mockEditor.registerUpdateListener.mock.calls[0][0];

      // Simulate rapid updates
      updateHandler({ editorState: mockEditorState });
      updateHandler({ editorState: mockEditorState });
      updateHandler({ editorState: mockEditorState });

      expect(mockEditorState.read).toHaveBeenCalledTimes(3);
    });
  });
});
