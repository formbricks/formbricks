import { $generateNodesFromDOM } from "@lexical/html";
import {
  $createParagraphNode,
  $isDecoratorNode,
  $isElementNode,
  type LexicalEditor,
  type LexicalNode,
  type ParagraphNode,
} from "lexical";

const isBlockNode = (node: LexicalNode): boolean =>
  ($isElementNode(node) || $isDecoratorNode(node)) && !node.isInline();

/**
 * Parses stored HTML into nodes the editor's root accepts. The root takes block nodes only, and HTML
 * whose top level holds inline content (bare text, a link, a line break) throws Lexical error #282 on
 * `root.append` (ENG-643). Each run of top-level inline nodes is wrapped in one paragraph.
 */
export const $generateRootNodesFromHtml = (editor: LexicalEditor, html: string): LexicalNode[] => {
  const dom = new DOMParser().parseFromString(html, "text/html");
  const rootNodes: LexicalNode[] = [];
  let paragraph: ParagraphNode | null = null;

  for (const node of $generateNodesFromDOM(editor, dom)) {
    if (isBlockNode(node)) {
      rootNodes.push(node);
      paragraph = null;
      continue;
    }
    if (!paragraph) {
      paragraph = $createParagraphNode();
      rootNodes.push(paragraph);
    }
    paragraph.append(node);
  }

  return rootNodes;
};
