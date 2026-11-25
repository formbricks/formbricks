/**
 * @vitest-environment jsdom
 */
import { $generateNodesFromDOM } from "@lexical/html";
import {
  $addUpdateTag,
  $createTextNode,
  $getRoot,
  type LexicalEditor,
  ParagraphNode,
  TextNode,
  createEditor,
} from "lexical";
import { describe, expect, test } from "vitest";
import { CONTENT_IMPORT_TAG, registerContentWriteBack } from "./content-write-back";

const createTestEditor = (): LexicalEditor =>
  createEditor({
    namespace: "test",
    nodes: [ParagraphNode, TextNode],
    onError: (error) => {
      throw error;
    },
  });

// What the editor does when it loads a stored value: parse the HTML and replace the root's content.
const loadStoredContent = (editor: LexicalEditor, html: string) =>
  editor.update(
    () => {
      $addUpdateTag(CONTENT_IMPORT_TAG);
      const dom = new DOMParser().parseFromString(html, "text/html");
      const root = $getRoot();
      root.clear();
      root.append(...$generateNodesFromDOM(editor, dom));
    },
    { discrete: true }
  );

describe("registerContentWriteBack", () => {
  test("loading the stored value into the editor writes nothing back", () => {
    const editor = createTestEditor();
    const written: string[] = [];
    registerContentWriteBack(editor, (html) => written.push(html));

    loadStoredContent(editor, "<p>Coming soon...</p>");

    expect(written).toEqual([]);
  });

  test("moving the caret or focusing the editor writes nothing back", () => {
    const editor = createTestEditor();
    loadStoredContent(editor, "<p>Coming soon...</p>");
    const written: string[] = [];
    registerContentWriteBack(editor, (html) => written.push(html));

    editor.update(
      () => {
        $getRoot().getFirstChildOrThrow<ParagraphNode>().selectEnd();
      },
      { discrete: true }
    );

    expect(written).toEqual([]);
  });

  test("an edit writes the content back as HTML", () => {
    const editor = createTestEditor();
    loadStoredContent(editor, "<p>Coming soon...</p>");
    const written: string[] = [];
    registerContentWriteBack(editor, (html) => written.push(html));

    editor.update(
      () => {
        $getRoot().getFirstChildOrThrow<ParagraphNode>().append($createTextNode(" Stay tuned"));
      },
      { discrete: true }
    );

    expect(written).toHaveLength(1);
    expect(written[0]).toContain("Coming soon...");
    expect(written[0]).toContain("Stay tuned");
  });
});
