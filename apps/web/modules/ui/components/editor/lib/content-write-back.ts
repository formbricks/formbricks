import { $generateHtmlFromNodes } from "@lexical/html";
import type { LexicalEditor } from "lexical";
import { toEditorOutputHtml } from "./exported-html";

/**
 * Tags an editor update that loads the stored value into the editor (on mount, or on a deliberate
 * reload), so the write-back can tell it from an edit: call `$addUpdateTag(CONTENT_IMPORT_TAG)` in that
 * update.
 */
export const CONTENT_IMPORT_TAG = "formbricks-content-import";

/**
 * Writes the editor's content back to its owner as HTML whenever the user changes it, and returns the
 * function that stops it.
 *
 * Only edits count. Loading the stored value and moving the caret (focus, clicks, selection) also
 * commit editor updates, and writing those back would replace a stored plain-text value with the
 * editor's HTML for it although nobody changed anything: opening a survey and saving it rewrote every
 * plain-text headline (ENG-2143). A plain-text value becomes HTML only once it is edited.
 */
export const registerContentWriteBack = (
  editor: LexicalEditor,
  onChange: (html: string) => void,
  { keepEscapedText = false }: { keepEscapedText?: boolean } = {}
): (() => void) =>
  editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
    if (tags.has(CONTENT_IMPORT_TAG)) return;
    // A selection-only update marks no node dirty.
    if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
    editorState.read(() => {
      onChange(toEditorOutputHtml($generateHtmlFromNodes(editor), { keepEscapedText }));
    });
  });
