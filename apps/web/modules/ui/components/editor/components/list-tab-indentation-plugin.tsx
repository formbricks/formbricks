import { $isListItemNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, $handleIndentAndOutdent, mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_EDITOR,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from "lexical";
import { useEffect } from "react";

// Same cap as Lexical's playground (maxIndent 7): items can nest up to indent level 6.
const MAX_INDENT = 7;

/**
 * Scoped alternative to Lexical's TabIndentationPlugin: Tab indents and Shift+Tab outdents only
 * while the selection is inside list items, so Tab keeps moving focus everywhere else and the
 * editor does not trap keyboard users.
 */
export const ListTabIndentationPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return false;
          }
          const anchorListItem = $findMatchingParent(selection.anchor.getNode(), $isListItemNode);
          const focusListItem = $findMatchingParent(selection.focus.getNode(), $isListItemNode);
          if (!anchorListItem || !focusListItem) {
            return false;
          }
          event.preventDefault();
          return editor.dispatchCommand(
            event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
            undefined
          );
        },
        COMMAND_PRIORITY_EDITOR
      ),
      // Caps indentation before @lexical/rich-text's uncapped INDENT_CONTENT_COMMAND handler runs.
      editor.registerCommand(
        INDENT_CONTENT_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return false;
          }
          return $handleIndentAndOutdent((block) => {
            const newIndent = block.getIndent() + 1;
            if (newIndent < MAX_INDENT) {
              block.setIndent(newIndent);
            }
          });
        },
        COMMAND_PRIORITY_CRITICAL
      )
    );
  }, [editor]);

  return null;
};
