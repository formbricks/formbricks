import { $createTextNode, type LexicalEditor, type LexicalNode, TextNode } from "lexical";
import { $createTokenChipNode } from "../components/token-chip-node";
import { type TEditorTokenChip, splitTextAtTokens } from "./token-chips";

/**
 * Shows each of `chips`' tokens as a chip wherever it appears in the text, whether seeded, typed or
 * pasted. The text around a token keeps its formatting. Returns the unregister function.
 */
export const registerTokenChipTransform = (
  editor: LexicalEditor,
  chips: readonly TEditorTokenChip[]
): (() => void) => {
  const chipsByToken = new Map(chips.map((chip) => [chip.token, chip]));
  const tokens = [...chipsByToken.keys()];

  return editor.registerNodeTransform(TextNode, (node) => {
    if (!node.isSimpleText()) return;
    const parts = splitTextAtTokens(node.getTextContent(), tokens);
    if (!parts) return;

    const replacements: LexicalNode[] = parts.map((part) => {
      if (part.kind === "token") return $createTokenChipNode(chipsByToken.get(part.token)!);
      return $createTextNode(part.text).setFormat(node.getFormat()).setStyle(node.getStyle());
    });
    let previous: LexicalNode = node;
    for (const replacement of replacements) {
      previous.insertAfter(replacement);
      previous = replacement;
    }
    node.remove();
  });
};
