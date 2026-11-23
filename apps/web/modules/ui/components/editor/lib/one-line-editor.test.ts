import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  LineBreakNode,
  ParagraphNode,
  TextNode,
  createEditor,
} from "lexical";
import { describe, expect, test } from "vitest";
import { $getOneLineText, $setOneLineText, registerOneLineEditor } from "./one-line-editor";

const createOneLineEditor = (): LexicalEditor => {
  const editor = createEditor({
    namespace: "test",
    nodes: [ParagraphNode, TextNode, LineBreakNode],
    onError: (error) => {
      throw error;
    },
  });
  registerOneLineEditor(editor);
  return editor;
};

const readText = (editor: LexicalEditor) => editor.getEditorState().read(() => $getOneLineText());

describe("one-line editor", () => {
  test("reads back the text it was seeded with, recall tokens included", () => {
    const editor = createOneLineEditor();
    const stored = "Bearer #recall:steps.auth.body.token/fallback:none# and more";
    editor.update(() => $setOneLineText(stored), { discrete: true });

    expect(readText(editor)).toBe(stored);
  });

  test("an empty value reads back as empty", () => {
    const editor = createOneLineEditor();
    editor.update(() => $setOneLineText(""), { discrete: true });

    expect(readText(editor)).toBe("");
  });

  test("a pasted second line joins the first, separated by a space", () => {
    const editor = createOneLineEditor();
    editor.update(
      () => {
        const first = $createParagraphNode().append($createTextNode("first"));
        const second = $createParagraphNode().append($createTextNode("second"));
        $getRoot().clear().append(first, second);
      },
      { discrete: true }
    );

    expect(readText(editor)).toBe("first second");
    expect(editor.getEditorState().read(() => $getRoot().getChildrenSize())).toBe(1);
  });

  test("a line break becomes a space", () => {
    const editor = createOneLineEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode().append(
          $createTextNode("a"),
          $createLineBreakNode(),
          $createTextNode("b")
        );
        $getRoot().clear().append(paragraph);
      },
      { discrete: true }
    );

    expect(readText(editor)).toBe("a b");
  });

  test("Enter is swallowed instead of starting a new line", () => {
    const editor = createOneLineEditor();

    expect(editor.dispatchCommand(KEY_ENTER_COMMAND, null)).toBe(true);
  });
});
