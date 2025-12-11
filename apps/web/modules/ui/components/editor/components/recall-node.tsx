"use client";

import type { DOMConversionMap, DOMConversionOutput, DOMExportOutput, NodeKey, Spread } from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import { ReactNode } from "react";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getTextContentWithRecallTruncated } from "@/lib/utils/recall";

export interface RecallPayload {
  recallItem: TSurveyRecallItem;
  fallbackValue?: string;
  key?: NodeKey;
}

export interface SerializedRecallNode extends Spread<RecallPayload, { type: "recall"; version: 1 }> {}

const convertRecallElement = (domNode: Node): null | DOMConversionOutput => {
  const node = domNode as HTMLElement;
  if (node.dataset.recallId) {
    const recallId = node.dataset.recallId;
    const recallLabel = node.dataset.recallLabel;
    const recallType = node.dataset.recallType;
    const fallbackValue = node.dataset.fallbackValue || "";

    if (recallId && recallLabel && recallType) {
      const recallItem: TSurveyRecallItem = {
        id: recallId,
        label: recallLabel,
        type: recallType as TSurveyRecallItem["type"],
      };

      const node = $createRecallNode({ recallItem, fallbackValue });
      return { node };
    }
  }
  return null;
};

export class RecallNode extends DecoratorNode<ReactNode> {
  __recallItem: TSurveyRecallItem;
  __fallbackValue: string;

  static readonly $config = {
    type: "recall",
    inline: true,
  } as const;

  static getType(): string {
    return RecallNode.$config.type;
  }

  static clone(node: RecallNode): RecallNode {
    return new RecallNode(
      {
        recallItem: node.__recallItem,
        fallbackValue: node.__fallbackValue,
      },
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedRecallNode): RecallNode {
    const { recallItem, fallbackValue } = serializedNode;
    return $createRecallNode({ recallItem, fallbackValue });
  }

  exportJSON(): SerializedRecallNode {
    return {
      recallItem: this.__recallItem,
      fallbackValue: this.__fallbackValue,
      type: "recall",
      version: 1,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: () => ({
        conversion: convertRecallElement,
        priority: 1,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.dataset.recallId = this.__recallItem.id;
    element.dataset.recallLabel = this.__recallItem.label;
    element.dataset.recallType = this.__recallItem.type;
    element.dataset.fallbackValue = this.__fallbackValue;
    element.className = "recall-node";
    element.textContent = `#recall:${this.__recallItem.id}/fallback:${this.__fallbackValue}#`;
    return { element };
  }

  constructor(payload?: RecallPayload, key?: NodeKey) {
    super(key);
    const defaultPayload: RecallPayload = {
      recallItem: { id: "", label: "", type: "element" },
      fallbackValue: "",
    };
    const actualPayload = payload || defaultPayload;
    this.__recallItem = actualPayload.recallItem;
    this.__fallbackValue = actualPayload.fallbackValue || "";
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.className = "recall-node-placeholder";
    // Don't set text content here - let decorate() handle it
    return dom;
  }

  updateDOM(_prevNode: RecallNode): boolean {
    // Return false - let decorate() handle all rendering
    return false;
  }

  getRecallItem(): TSurveyRecallItem {
    return this.__recallItem;
  }

  getFallbackValue(): string {
    return this.__fallbackValue;
  }

  setFallbackValue(fallbackValue: string): void {
    const writable = this.getWritable();
    writable.__fallbackValue = fallbackValue;
  }

  getTextContent(): string {
    return `#recall:${this.__recallItem.id}/fallback:${this.__fallbackValue}#`;
  }

  decorate(): ReactNode {
    const displayLabel = getTextContentWithRecallTruncated(this.__recallItem.label);

    return (
      <span
        className="recall-node z-30 inline-flex h-fit justify-center whitespace-nowrap rounded-md bg-slate-100 text-sm text-slate-700"
        aria-label={`Recall: ${displayLabel}`}
        title={displayLabel}>
        @{displayLabel}
      </span>
    );
  }

  isInline(): boolean {
    return RecallNode.$config.inline;
  }
}

export const $createRecallNode = (payload: RecallPayload): RecallNode => {
  return $applyNodeReplacement(new RecallNode(payload));
};
