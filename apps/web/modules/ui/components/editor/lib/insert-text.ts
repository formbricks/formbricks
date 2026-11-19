import { $createParagraphNode, $getRoot, $getSelection, $isParagraphNode, $isRangeSelection } from "lexical";

/**
 * Types `text` at the cursor, replacing a selected range. A control outside the editor (a toolbar
 * popover) calls it after focus has left: the editor keeps its last cursor until another editor takes
 * it. With no cursor at all (the editor was never focused) the text goes on a line of its own at the
 * end, reusing an empty last paragraph. Call inside `editor.update`.
 */
export const $insertTextAtCursor = (text: string): void => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.insertText(text);
    return;
  }

  const root = $getRoot();
  const last = root.getLastChild();
  const paragraph = $isParagraphNode(last) && last.isEmpty() ? last : $createParagraphNode();
  if (paragraph !== last) root.append(paragraph);
  paragraph.selectEnd().insertText(text);
};
