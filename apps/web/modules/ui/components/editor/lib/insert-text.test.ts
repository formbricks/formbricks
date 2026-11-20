/**
 * @vitest-environment jsdom
 */
import { $generateHtmlFromNodes } from "@lexical/html";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $setSelection,
  type LexicalEditor,
  ParagraphNode,
  TextNode,
  createEditor,
} from "lexical";
import { describe, expect, test } from "vitest";
import { TokenChipNode } from "../components/token-chip-node";
import { $insertTextAtCursor } from "./insert-text";
import { registerTokenChipTransform } from "./token-chip-transform";

const LINK = { token: "#survey-link#", label: "Survey link" };

const createSeededEditor = (paragraphs: string[]): LexicalEditor => {
  const editor = createEditor({
    namespace: "test",
    nodes: [ParagraphNode, TextNode, TokenChipNode],
    onError: (error) => {
      throw error;
    },
  });
  registerTokenChipTransform(editor, [LINK]);
  editor.update(
    () => {
      for (const text of paragraphs) {
        const paragraph = $createParagraphNode();
        if (text) paragraph.append($createTextNode(text));
        $getRoot().append(paragraph);
      }
    },
    { discrete: true }
  );
  return editor;
};

const insert = (editor: LexicalEditor, select: () => void) =>
  editor.update(
    () => {
      select();
      $insertTextAtCursor(LINK.token);
    },
    { discrete: true }
  );

const html = (editor: LexicalEditor) => editor.getEditorState().read(() => $generateHtmlFromNodes(editor));

describe("$insertTextAtCursor", () => {
  test("types at the cursor, mid-sentence", () => {
    const editor = createSeededEditor(["Answer here:  thanks"]);
    insert(editor, () => {
      const text = $getRoot().getFirstDescendant() as TextNode;
      text.select(13, 13);
    });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe("Answer here: #survey-link# thanks");
      expect($getRoot().getAllTextNodes()).toHaveLength(2);
    });
  });

  test("without a cursor, puts the text on a new line at the end", () => {
    const editor = createSeededEditor(["Hi there"]);
    insert(editor, () => $setSelection(null));
    const paragraphs = editor.getEditorState().read(() => $getRoot().getChildren());
    expect(paragraphs).toHaveLength(2);
    expect(html(editor)).toMatch(/Hi there.*<\/p><p[^>]*>.*#survey-link#/);
  });

  test("without a cursor, reuses an empty last line", () => {
    const editor = createSeededEditor(["Hi there", ""]);
    insert(editor, () => $setSelection(null));
    expect(editor.getEditorState().read(() => $getRoot().getChildrenSize())).toBe(2);
  });
});
