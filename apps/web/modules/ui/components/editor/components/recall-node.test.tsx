import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { $applyNodeReplacement } from "lexical";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { replaceRecallInfoWithUnderline } from "@/lib/utils/recall";
import { $createRecallNode, RecallNode, RecallPayload, SerializedRecallNode } from "./recall-node";

vi.mock("lexical", () => ({
  $applyNodeReplacement: vi.fn((node) => node),
  DecoratorNode: class DecoratorNode {
    __key: string;
    constructor(key?: string) {
      this.__key = key || "test-key";
    }
    getWritable() {
      return this;
    }
  },
}));

vi.mock("@/lib/utils/recall", () => ({
  replaceRecallInfoWithUnderline: vi.fn((label: string) => {
    return label.replace(/#recall:[^#]+#/g, "___");
  }),
}));

describe("RecallNode", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockRecallItem: TSurveyRecallItem = {
    id: "question123",
    label: "What is your name?",
    type: "question",
  };

  const mockPayload: RecallPayload = {
    recallItem: mockRecallItem,
    fallbackValue: "default value",
  };

  describe("RecallNode.getType", () => {
    test("returns correct type", () => {
      expect(RecallNode.getType()).toBe("recall");
    });
  });

  describe("RecallNode.clone", () => {
    test("creates a clone of the node with same properties", () => {
      const node = new RecallNode(mockPayload);
      const clonedNode = RecallNode.clone(node);

      expect(clonedNode).toBeInstanceOf(RecallNode);
      expect(clonedNode.getRecallItem()).toEqual(mockRecallItem);
      expect(clonedNode.getFallbackValue()).toBe("default value");
    });
  });

  describe("RecallNode.importJSON", () => {
    test("creates node from serialized data", () => {
      const serializedNode: SerializedRecallNode = {
        recallItem: mockRecallItem,
        fallbackValue: "imported value",
        type: "recall",
        version: 1,
      };

      const node = RecallNode.importJSON(serializedNode);

      expect(node).toBeInstanceOf(RecallNode);
      expect(node.getRecallItem()).toEqual(mockRecallItem);
      expect(node.getFallbackValue()).toBe("imported value");
    });

    test("handles missing fallbackValue", () => {
      const serializedNode: SerializedRecallNode = {
        recallItem: mockRecallItem,
        type: "recall",
        version: 1,
      };

      const node = RecallNode.importJSON(serializedNode);

      expect(node).toBeInstanceOf(RecallNode);
      expect(node.getFallbackValue()).toBe("");
    });
  });

  describe("RecallNode.exportJSON", () => {
    test("exports node to JSON format", () => {
      const node = new RecallNode(mockPayload);
      const exported = node.exportJSON();

      expect(exported).toEqual({
        recallItem: mockRecallItem,
        fallbackValue: "default value",
        type: "recall",
        version: 1,
      });
    });
  });

  describe("RecallNode.importDOM", () => {
    test("returns correct DOM conversion map", () => {
      const domMap = RecallNode.importDOM();

      expect(domMap).not.toBeNull();
      expect(domMap).toHaveProperty("span");

      if (domMap?.span) {
        expect(domMap.span).toBeDefined();
        const testNode = document.createElement("span");
        const spanConfig = domMap.span(testNode);
        if (spanConfig) {
          expect(spanConfig.priority).toBe(1);
          expect(spanConfig.conversion).toBeDefined();
        }
      }
    });

    test("converts valid span element with recall data attributes", () => {
      const domMap = RecallNode.importDOM();

      if (domMap?.span) {
        const spanElement = document.createElement("span");
        spanElement.dataset.recallId = "q1";
        spanElement.dataset.recallLabel = "Question One";
        spanElement.dataset.recallType = "question";
        spanElement.dataset.fallbackValue = "fallback text";

        const spanConfig = domMap.span(spanElement);
        if (spanConfig) {
          const conversionFn = spanConfig.conversion;
          const result = conversionFn(spanElement);

          expect(result).not.toBeNull();
          if (result && result.node instanceof RecallNode) {
            expect(result.node).toBeInstanceOf(RecallNode);
            expect(result.node.getRecallItem()).toEqual({
              id: "q1",
              label: "Question One",
              type: "question",
            });
            expect(result.node.getFallbackValue()).toBe("fallback text");
          }
        }
      }
    });

    test("handles span without data-recall-id attribute", () => {
      const domMap = RecallNode.importDOM();

      if (domMap?.span) {
        const spanElement = document.createElement("span");
        spanElement.dataset.recallLabel = "Question One";
        spanElement.dataset.recallType = "question";

        const spanConfig = domMap.span(spanElement);
        if (spanConfig) {
          const conversionFn = spanConfig.conversion;
          const result = conversionFn(spanElement);

          expect(result).toBeNull();
        }
      }
    });

    test("handles span with missing fallback-value attribute", () => {
      const domMap = RecallNode.importDOM();

      if (domMap?.span) {
        const spanElement = document.createElement("span");
        spanElement.dataset.recallId = "q1";
        spanElement.dataset.recallLabel = "Question One";
        spanElement.dataset.recallType = "question";

        const spanConfig = domMap.span(spanElement);
        if (spanConfig) {
          const conversionFn = spanConfig.conversion;
          const result = conversionFn(spanElement);

          expect(result).not.toBeNull();
          if (result && result.node instanceof RecallNode) {
            expect(result.node.getFallbackValue()).toBe("");
          }
        }
      }
    });

    test("returns null for span without required attributes", () => {
      const domMap = RecallNode.importDOM();

      if (domMap?.span) {
        const spanElement = document.createElement("span");
        spanElement.dataset.recallId = "q1";

        const spanConfig = domMap.span(spanElement);
        if (spanConfig) {
          const conversionFn = spanConfig.conversion;
          const result = conversionFn(spanElement);

          expect(result).toBeNull();
        }
      }
    });
  });

  describe("RecallNode.exportDOM", () => {
    test("exports node to DOM element with correct attributes", () => {
      const node = new RecallNode(mockPayload);
      const { element } = node.exportDOM();

      if (element && element instanceof HTMLElement) {
        expect(element.tagName).toBe("SPAN");
        expect(element.dataset.recallId).toBe("question123");
        expect(element.dataset.recallLabel).toBe("What is your name?");
        expect(element.dataset.recallType).toBe("question");
        expect(element.dataset.fallbackValue).toBe("default value");
        expect(element.className).toBe("recall-node");
        expect(element.textContent).toBe("#recall:question123/fallback:default value#");
      }
    });

    test("exports node with empty fallback value", () => {
      const payload: RecallPayload = {
        recallItem: mockRecallItem,
        fallbackValue: "",
      };
      const node = new RecallNode(payload);
      const { element } = node.exportDOM();

      if (element && element instanceof HTMLElement) {
        expect(element.dataset.fallbackValue).toBe("");
        expect(element.textContent).toBe("#recall:question123/fallback:#");
      }
    });
  });

  describe("RecallNode constructor", () => {
    test("creates node with provided payload", () => {
      const node = new RecallNode(mockPayload);

      expect(node.getRecallItem()).toEqual(mockRecallItem);
      expect(node.getFallbackValue()).toBe("default value");
    });

    test("creates node with default values when no payload provided", () => {
      const node = new RecallNode();

      expect(node.getRecallItem()).toEqual({
        id: "",
        label: "",
        type: "question",
      });
      expect(node.getFallbackValue()).toBe("");
    });

    test("creates node with missing fallbackValue in payload", () => {
      const payload: RecallPayload = {
        recallItem: mockRecallItem,
      };
      const node = new RecallNode(payload);

      expect(node.getFallbackValue()).toBe("");
    });
  });

  describe("RecallNode.createDOM", () => {
    test("creates DOM element with correct classes", () => {
      const node = new RecallNode(mockPayload);
      const dom = node.createDOM();

      expect(dom.tagName).toBe("SPAN");
      expect(dom.className).toBe("recall-node-placeholder");
    });
  });

  describe("RecallNode.updateDOM", () => {
    test("always returns false", () => {
      const node = new RecallNode(mockPayload);
      expect(node.updateDOM()).toBe(false);
    });
  });

  describe("RecallNode.getRecallItem", () => {
    test("returns the recall item", () => {
      const node = new RecallNode(mockPayload);
      const recallItem = node.getRecallItem();

      expect(recallItem).toEqual(mockRecallItem);
    });
  });

  describe("RecallNode.getFallbackValue", () => {
    test("returns the fallback value", () => {
      const node = new RecallNode(mockPayload);
      const fallbackValue = node.getFallbackValue();

      expect(fallbackValue).toBe("default value");
    });
  });

  describe("RecallNode.setFallbackValue", () => {
    test("updates the fallback value", () => {
      const node = new RecallNode(mockPayload);
      node.setFallbackValue("new value");

      expect(node.getFallbackValue()).toBe("new value");
    });

    test("can set empty fallback value", () => {
      const node = new RecallNode(mockPayload);
      node.setFallbackValue("");

      expect(node.getFallbackValue()).toBe("");
    });
  });

  describe("RecallNode.getTextContent", () => {
    test("returns correct text content format", () => {
      const node = new RecallNode(mockPayload);
      const textContent = node.getTextContent();

      expect(textContent).toBe("#recall:question123/fallback:default value#");
    });

    test("returns text content with empty fallback", () => {
      const payload: RecallPayload = {
        recallItem: mockRecallItem,
        fallbackValue: "",
      };
      const node = new RecallNode(payload);
      const textContent = node.getTextContent();

      expect(textContent).toBe("#recall:question123/fallback:#");
    });
  });

  describe("RecallNode.decorate", () => {
    test("renders recall node with correct label", () => {
      const node = new RecallNode(mockPayload);
      const decorated = node.decorate();

      const { container } = render(<>{decorated}</>);
      const span = container.querySelector("span");

      expect(span).toBeInTheDocument();
      expect(span).toHaveClass("recall-node");
      expect(span).toHaveClass("bg-slate-100");
      expect(span?.textContent).toContain("@");
    });

    test("calls replaceRecallInfoWithUnderline with label", () => {
      const node = new RecallNode(mockPayload);
      node.decorate();

      expect(vi.mocked(replaceRecallInfoWithUnderline)).toHaveBeenCalledWith("What is your name?");
    });

    test("handles label with nested recall patterns", () => {
      vi.mocked(replaceRecallInfoWithUnderline).mockReturnValueOnce("Processed Label");

      const payloadWithNestedRecall: RecallPayload = {
        recallItem: {
          id: "q1",
          label: "What is your #recall:name/fallback:name# answer?",
          type: "question",
        },
        fallbackValue: "default",
      };

      const node = new RecallNode(payloadWithNestedRecall);
      const decorated = node.decorate();

      const { container } = render(<>{decorated}</>);
      expect(vi.mocked(replaceRecallInfoWithUnderline)).toHaveBeenCalledWith(
        "What is your #recall:name/fallback:name# answer?"
      );
      expect(container.textContent).toContain("@Processed Label");
    });
  });

  describe("RecallNode.isInline", () => {
    test("returns true for inline configuration", () => {
      const node = new RecallNode(mockPayload);
      expect(node.isInline()).toBe(true);
    });
  });

  describe("$createRecallNode", () => {
    test("creates a new RecallNode instance", () => {
      const node = $createRecallNode(mockPayload);

      expect(node).toBeInstanceOf(RecallNode);
      expect(node.getRecallItem()).toEqual(mockRecallItem);
      expect(node.getFallbackValue()).toBe("default value");
    });

    test("applies node replacement", () => {
      $createRecallNode(mockPayload);

      expect($applyNodeReplacement).toHaveBeenCalled();
    });

    test("creates node with different recall types", () => {
      const hiddenFieldPayload: RecallPayload = {
        recallItem: {
          id: "hf1",
          label: "Hidden Field",
          type: "hiddenField",
        },
        fallbackValue: "hidden value",
      };

      const node = $createRecallNode(hiddenFieldPayload);

      expect(node.getRecallItem().type).toBe("hiddenField");
    });

    test("creates node with variable type", () => {
      const variablePayload: RecallPayload = {
        recallItem: {
          id: "var1",
          label: "Variable Name",
          type: "variable",
        },
        fallbackValue: "variable value",
      };

      const node = $createRecallNode(variablePayload);

      expect(node.getRecallItem().type).toBe("variable");
    });
  });

  describe("RecallNode static config", () => {
    test("has correct static configuration", () => {
      expect(RecallNode.$config.type).toBe("recall");
      expect(RecallNode.$config.inline).toBe(true);
    });
  });

  describe("RecallNode edge cases", () => {
    test("handles special characters in recall item label", () => {
      const specialPayload: RecallPayload = {
        recallItem: {
          id: "q1",
          label: "What's your <name> & (email)?",
          type: "question",
        },
        fallbackValue: "default",
      };

      const node = new RecallNode(specialPayload);
      const { element } = node.exportDOM();

      if (element && element instanceof HTMLElement) {
        expect(element.dataset.recallLabel).toBe("What's your <name> & (email)?");
      }
    });

    test("handles special characters in fallback value", () => {
      const specialPayload: RecallPayload = {
        recallItem: mockRecallItem,
        fallbackValue: "default & special <value>",
      };

      const node = new RecallNode(specialPayload);
      const { element } = node.exportDOM();

      if (element && element instanceof HTMLElement) {
        expect(element.dataset.fallbackValue).toBe("default & special <value>");
      }
    });

    test("handles long recall item labels", () => {
      const longLabel = "A".repeat(1000);
      const longPayload: RecallPayload = {
        recallItem: {
          id: "q1",
          label: longLabel,
          type: "question",
        },
        fallbackValue: "default",
      };

      const node = new RecallNode(longPayload);
      expect(node.getRecallItem().label).toBe(longLabel);
    });

    test("handles unicode characters in labels", () => {
      const unicodePayload: RecallPayload = {
        recallItem: {
          id: "q1",
          label: "你好世界 🌍 مرحبا",
          type: "question",
        },
        fallbackValue: "unicode value",
      };

      const node = new RecallNode(unicodePayload);
      const decorated = node.decorate();
      const { container } = render(<>{decorated}</>);

      expect(container).toBeInTheDocument();
    });
  });
});
