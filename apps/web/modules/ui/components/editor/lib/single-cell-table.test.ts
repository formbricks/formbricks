// @vitest-environment jsdom
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $getRoot, createEditor } from "lexical";
import { describe, expect, test } from "vitest";
import { $generateRootNodesFromHtml } from "./root-nodes";
import { $unwrapSingleCellTable } from "./single-cell-table";

const readEditor = (html: string) => {
  const editor = createEditor({
    nodes: [TableNode, TableRowNode, TableCellNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.registerNodeTransform(TableNode, $unwrapSingleCellTable);
  editor.update(() => $getRoot().append(...$generateRootNodesFromHtml(editor, html)), { discrete: true });
  return editor.getEditorState().read(() => {
    const root = $getRoot();
    return {
      types: root.getChildren().map((node) => node.getType()),
      text: root.getTextContent(),
      firstTextIsBold: root.getAllTextNodes()[0]?.hasFormat("bold"),
    };
  });
};

describe("$unwrapSingleCellTable", () => {
  test("keeps a spreadsheet cell's editable blocks and text formatting without its table", () => {
    const result = readEditor(
      '<table><tbody><tr><td style="width: 75px"><p><strong>Title</strong></p><p>Body</p></td></tr></tbody></table>'
    );

    expect(result).toEqual({
      types: ["paragraph", "paragraph"],
      text: "Title\n\nBody",
      firstTextIsBold: true,
    });
  });

  test.each([
    "<tr><td>One</td><td>Two</td></tr>",
    "<tr><td>One</td></tr><tr><td>Two</td></tr>",
    '<tr><td colspan="2">One</td></tr>',
    '<tr><td rowspan="2">One</td></tr>',
  ])("preserves a table with a multi-cell layout (%s)", (rows) => {
    expect(readEditor(`<table><tbody>${rows}</tbody></table>`).types).toEqual(["table"]);
  });
});
