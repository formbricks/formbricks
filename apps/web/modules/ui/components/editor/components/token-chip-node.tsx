import type { DOMExportOutput, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import type { ReactNode } from "react";
import type { TEditorTokenChip } from "../lib/token-chips";
import { TokenChipView } from "./token-chip-view";

export type SerializedTokenChipNode = Spread<{ chip: TEditorTokenChip }, SerializedLexicalNode>;

/**
 * A fixed token shown as a chip (see `TEditorTokenChip`). Its text and its exported HTML are exactly
 * the token, so whatever stores the editor's output sees the same text it always did. There is no
 * `importDOM`: the token arrives as plain text and `registerTokenChipTransform` turns it into a chip,
 * only in an editor that asked for it.
 */
/** What Lexical gets when it builds a node without arguments; `importJSON` fills the real one. */
const EMPTY_TOKEN_CHIP: TEditorTokenChip = { token: "", label: "" };

export class TokenChipNode extends DecoratorNode<ReactNode> {
  __chip: TEditorTokenChip;

  static getType(): string {
    return "token-chip";
  }

  static clone(node: TokenChipNode): TokenChipNode {
    return new TokenChipNode(node.__chip, node.__key);
  }

  static importJSON(serializedNode: SerializedTokenChipNode): TokenChipNode {
    return $createTokenChipNode(serializedNode.chip);
  }

  constructor(chip: TEditorTokenChip = EMPTY_TOKEN_CHIP, key?: NodeKey) {
    super(key);
    this.__chip = chip;
  }

  exportJSON(): SerializedTokenChipNode {
    return { ...super.exportJSON(), chip: this.__chip };
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createTextNode(this.__chip.token) };
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): boolean {
    return false;
  }

  getTextContent(): string {
    return this.__chip.token;
  }

  getLabel(): string {
    return this.__chip.label;
  }

  isInline(): boolean {
    return true;
  }

  decorate(): ReactNode {
    return <TokenChipView chip={this.__chip} />;
  }
}

export const $createTokenChipNode = (chip: TEditorTokenChip): TokenChipNode =>
  $applyNodeReplacement(new TokenChipNode(chip));

export const $isTokenChipNode = (node: LexicalNode | null | undefined): node is TokenChipNode =>
  node instanceof TokenChipNode;
