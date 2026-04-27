"use client";

import { $generateNodesFromDOM } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getSelection, $isRangeSelection, COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";

/**
 * Strips table-related HTML elements from pasted content and replaces them with
 * plain paragraph nodes containing the text content of each table cell.
 *
 * Without this plugin, pasting from spreadsheets (Excel, LibreOffice Calc) or
 * other table-based sources creates TableNode instances in the editor that have
 * no associated TablePlugin — making them impossible to select or delete via
 * keyboard or toolbar controls.
 *
 * @see https://github.com/formbricks/formbricks/issues/7570
 */
export const TablePastePlugin = (): null => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const htmlData = clipboardData.getData("text/html");
        if (!htmlData) return false;

        // Only intercept when the clipboard HTML contains a table element
        if (!/<table[\s>]/i.test(htmlData)) return false;

        event.preventDefault();

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          // Parse the HTML and flatten table structure into plain paragraphs
          const parser = new DOMParser();
          const dom = parser.parseFromString(htmlData, "text/html");

          // Replace each table with a sequence of paragraphs (one per row cell)
          const tables = Array.from(dom.querySelectorAll("table"));
          for (const table of tables) {
            const rows = Array.from(table.querySelectorAll("tr"));
            const fragment = dom.createDocumentFragment();

            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll("td, th"));
              // Join sibling cells with a tab character to preserve column separation
              const cellText = cells.map((cell) => cell.textContent ?? "").join("\t");
              if (cellText.trim() === "") continue;

              const p = dom.createElement("p");
              p.textContent = cellText;
              fragment.appendChild(p);
            }

            table.parentNode?.replaceChild(fragment, table);
          }

          // Also strip <colgroup> and <col> elements that sometimes appear outside tables
          dom.querySelectorAll("colgroup, col").forEach((el) => el.remove());

          const nodes = $generateNodesFromDOM(editor, dom);
          const validNodes = nodes.filter((node) => {
            // Filter out any residual table-type nodes that $generateNodesFromDOM may produce
            const type = node.getType();
            return type !== "table" && type !== "tablecell" && type !== "tablerow";
          });

          if (validNodes.length === 0) {
            // Fallback: insert a single paragraph with plain text
            const plainText = clipboardData.getData("text/plain");
            if (plainText) {
              const p = $createParagraphNode();
              selection.insertNodes([p]);
              p.select();
            }
            return;
          }

          selection.insertNodes(validNodes);
        });

        return true; // Command handled — prevent Lexical's default paste
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
};
