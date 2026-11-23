import { $generateHtmlFromNodes } from "@lexical/html";
import type { LexicalEditor } from "lexical";
import { toEditorOutputHtml } from "./exported-html";

/**
 * Writes the editor's content back to its owner as HTML on every committed update, and returns the
 * function that stops it.
 */
export const registerContentWriteBack = (
  editor: LexicalEditor,
  onChange: (html: string) => void,
  { keepEscapedText = false }: { keepEscapedText?: boolean } = {}
): (() => void) =>
  editor.registerUpdateListener(({ editorState }) => {
    editorState.read(() => {
      onChange(toEditorOutputHtml($generateHtmlFromNodes(editor), { keepEscapedText }));
    });
  });
