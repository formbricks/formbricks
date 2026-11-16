/**
 * @vitest-environment jsdom
 */
import { $generateHtmlFromNodes } from "@lexical/html";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type LexicalEditor,
  ParagraphNode,
  TextNode,
  createEditor,
} from "lexical";
import { describe, expect, test } from "vitest";
import { $isTokenChipNode, TokenChipNode } from "../components/token-chip-node";
import { registerTokenChipTransform } from "./token-chip-transform";

const LINK = { token: "#survey-link#", label: "Survey link" };

const createChipEditor = (): LexicalEditor => {
  const editor = createEditor({
    namespace: "test",
    nodes: [ParagraphNode, TextNode, TokenChipNode],
    onError: (error) => {
      throw error;
    },
  });
  registerTokenChipTransform(editor, [LINK]);
  return editor;
};

const setText = (editor: LexicalEditor, text: string) =>
  editor.update(
    () => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      $getRoot().clear().append(paragraph);
    },
    { discrete: true }
  );

const readChildren = (editor: LexicalEditor) =>
  editor.getEditorState().read(() =>
    $getRoot()
      .getFirstChildOrThrow<ParagraphNode>()
      .getChildren()
      .map((node) => ($isTokenChipNode(node) ? { chip: node.getLabel() } : { text: node.getTextContent() }))
  );

describe("registerTokenChipTransform", () => {
  test("turns the token into a chip and leaves the text around it", () => {
    const editor = createChipEditor();
    setText(editor, "Answer here: #survey-link# thanks");

    expect(readChildren(editor)).toEqual([
      { text: "Answer here: " },
      { chip: "Survey link" },
      { text: " thanks" },
    ]);
  });

  test("the chip reads back as exactly the token, so the stored text is unchanged", () => {
    const editor = createChipEditor();
    setText(editor, "Answer here: #survey-link# thanks");

    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe(
      "Answer here: #survey-link# thanks"
    );
  });

  test("leaves text without the token alone", () => {
    const editor = createChipEditor();
    setText(editor, "No link #survey-link here");

    expect(readChildren(editor)).toEqual([{ text: "No link #survey-link here" }]);
  });

  test("exports the chip as the bare token in the editor's HTML", () => {
    const editor = createChipEditor();
    setText(editor, "Answer here: #survey-link#");

    const html = editor.getEditorState().read(() => $generateHtmlFromNodes(editor));
    expect(html).toContain("#survey-link#</p>");
    expect(html).not.toContain("Survey link");
  });
});
