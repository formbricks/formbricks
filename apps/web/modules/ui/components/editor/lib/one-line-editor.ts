import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  LineBreakNode,
  RootNode,
} from "lexical";

/**
 * A Lexical editor kept to one line of plain text, for a one-line field whose value is the text
 * itself (decorator nodes such as recall chips read back as their token). Enter does nothing, and a
 * pasted line break or second paragraph becomes a space. Returns the unregister function.
 */
export const registerOneLineEditor = (editor: LexicalEditor): (() => void) =>
  mergeRegister(
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        event?.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_HIGH
    ),
    editor.registerNodeTransform(LineBreakNode, (node) => {
      node.replace($createTextNode(" "));
    }),
    editor.registerNodeTransform(RootNode, (root) => {
      const [first, ...rest] = root.getChildren();
      if (!first || rest.length === 0 || !$isElementNode(first)) return;
      for (const extra of rest) {
        if ($isElementNode(extra) && extra.getChildrenSize() > 0) {
          first.append($createTextNode(" "), ...extra.getChildren());
        }
        extra.remove();
      }
    })
  );

/** Replaces the content with `text` as one paragraph; call inside `editor.update`. */
export const $setOneLineText = (text: string): void => {
  const paragraph = $createParagraphNode();
  if (text) paragraph.append($createTextNode(text));
  $getRoot().clear().append(paragraph);
};

/** The field's value; call inside a read or update. */
export const $getOneLineText = (): string => $getRoot().getTextContent();
