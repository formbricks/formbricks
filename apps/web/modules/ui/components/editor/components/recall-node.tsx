"use client";

import type { DOMConversionMap, DOMConversionOutput, DOMExportOutput, NodeKey, Spread } from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import { ReactNode } from "react";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { replaceRecallInfoWithUnderline } from "@/lib/utils/recall";

export interface RecallPayload {
  recallItem: TSurveyRecallItem;
  fallbackValue?: string;
  key?: NodeKey;
}

export interface SerializedRecallNode extends Spread<RecallPayload, { type: "recall"; version: 1 }> {}

const convertRecallElement = (domNode: Node): null | DOMConversionOutput => {
  const node = domNode as HTMLElement;
  if (node.getAttribute("data-recall-id")) {
    const recallId = node.getAttribute("data-recall-id");
    const recallLabel = node.getAttribute("data-recall-label");
    const recallType = node.getAttribute("data-recall-type");
    const fallbackValue = node.getAttribute("data-fallback-value") || "";

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
      type: "recall",
      version: 1,
      recallItem: this.__recallItem,
      fallbackValue: this.__fallbackValue,
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
    element.setAttribute("data-recall-id", this.__recallItem.id);
    element.setAttribute("data-recall-label", this.__recallItem.label);
    element.setAttribute("data-recall-type", this.__recallItem.type);
    element.setAttribute("data-fallback-value", this.__fallbackValue);
    element.className = "recall-node";
    element.textContent = `#recall:${this.__recallItem.id}/fallback:${this.__fallbackValue}#`;
    return { element };
  }

  constructor(payload: RecallPayload, key?: NodeKey) {
    super(key);
    this.__recallItem = payload.recallItem;
    this.__fallbackValue = payload.fallbackValue || "";
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.className =
      "recall-node z-30 inline-flex h-fit cursor-pointer justify-center whitespace-pre rounded-md bg-slate-100 text-sm px-1";
    return dom;
  }

  updateDOM(): false {
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
    const displayLabel = replaceRecallInfoWithUnderline(this.__recallItem.label);

    return (
      <span className="recall-node z-30 inline-flex h-fit cursor-pointer justify-center whitespace-pre rounded-md bg-slate-100 text-sm text-slate-700">
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
