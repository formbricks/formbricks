import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";

interface PasteLinkHandlerPluginProps {
  isExternalUrlsAllowed?: boolean;
}

export const PasteLinkHandlerPlugin = ({ isExternalUrlsAllowed }: PasteLinkHandlerPluginProps) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Only register the handler if external URLs are not allowed
    if (isExternalUrlsAllowed) {
      return;
    }

    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const text = clipboardData.getData("text/plain");
        const html = clipboardData.getData("text/html");

        // If there's HTML content with links, we need to strip them
        if (html && html.includes("<a ")) {
          event.preventDefault();

          // Parse the HTML and convert links to plain text
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const anchors = doc.querySelectorAll("a");

          // Replace all anchor tags with their text content
          anchors.forEach((anchor) => {
            const textNode = doc.createTextNode(anchor.textContent || "");
            anchor.replaceWith(textNode);
          });

          // Get the cleaned HTML
          const cleanedHtml = doc.body.innerHTML;

          // Create a new clipboard event with cleaned HTML
          const newClipboardData = new DataTransfer();
          newClipboardData.setData("text/html", cleanedHtml);
          newClipboardData.setData("text/plain", text);

          // Create a new paste event
          const newEvent = new ClipboardEvent("paste", {
            clipboardData: newClipboardData,
            bubbles: true,
            cancelable: true,
          });

          // Dispatch the new event
          event.target?.dispatchEvent(newEvent);

          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, isExternalUrlsAllowed]);

  return null;
};
