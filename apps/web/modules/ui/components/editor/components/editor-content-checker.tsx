import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { useEffect } from "react";

export const EditorContentChecker = ({ onEmptyChange }: { onEmptyChange: (isEmpty: boolean) => void }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const checkIfEmpty = () => {
      editor.update(() => {
        const root = $getRoot();
        const isEmpty = root.getChildren().length === 0 || root.getTextContent().trim() === "";
        onEmptyChange(isEmpty);
      });
    };

    // Check initially and subscribe to editor updates
    checkIfEmpty();
    const unregister = editor.registerUpdateListener(() => checkIfEmpty());

    return () => unregister();
  }, [editor, onEmptyChange]);

  return null;
};
