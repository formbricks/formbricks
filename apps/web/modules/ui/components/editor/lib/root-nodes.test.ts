// @vitest-environment jsdom
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, createEditor } from "lexical";
import { describe, expect, test } from "vitest";
import { $generateRootNodesFromHtml } from "./root-nodes";

const seed = (html: string) => {
  const editor = createEditor({
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode],
    onError: (error) => {
      throw error;
    },
  });
  let result: { types: string[]; text: string } = { types: [], text: "" };
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      root.append(...$generateRootNodesFromHtml(editor, html));
      result = { types: root.getChildren().map((node) => node.getType()), text: root.getTextContent() };
    },
    { discrete: true }
  );
  return result;
};

describe("$generateRootNodesFromHtml", () => {
  // ENG-643: links separated by line breaks with no wrapping block threw Lexical error #282 on seed.
  test("wraps top-level links and line breaks in one paragraph instead of throwing", () => {
    const { types, text } = seed('<a href="/s/a?lang=ro">Română</a><br><a href="/s/a?lang=en">English</a>');

    expect(types).toEqual(["paragraph"]);
    expect(text).toBe("Română\nEnglish");
  });

  test("wraps top-level text in a paragraph", () => {
    expect(seed("hello <b>world</b>").types).toEqual(["paragraph"]);
  });

  test("keeps block nodes as they are and wraps only the inline run between them", () => {
    const { types, text } = seed("<h1>Title</h1>loose <a href='https://a.com'>link</a><p>Body</p>");

    expect(types).toEqual(["heading", "paragraph", "paragraph"]);
    expect(text).toBe("Title\n\nloose link\n\nBody");
  });

  test("leaves well-formed editor output unchanged", () => {
    const { types } = seed(
      '<p class="fb-editor-paragraph"><a href="https://a.com">x</a></p><ul><li>y</li></ul>'
    );

    expect(types).toEqual(["paragraph", "list"]);
  });

  test("adds no paragraph for whitespace between block tags", () => {
    expect(seed("<p>a</p>\n  <p>b</p>\n").types).toEqual(["paragraph", "paragraph"]);
  });
});
