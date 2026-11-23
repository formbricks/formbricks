"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW } from "lexical";
import { useEffect } from "react";

/**
 * A click on a recall chip opens its fallback, the chip's only setting. Hands over the clicked chip's
 * recall id (`data-recall-id`), so the fallback popover can focus that chip's field.
 */
export const ChipClickPlugin = ({
  onChipClick,
}: Readonly<{ onChipClick: (recallId: string | undefined) => void }>) => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          const chip = event.target instanceof Element ? event.target.closest(".recall-node") : null;
          if (chip) onChipClick(chip instanceof HTMLElement ? chip.dataset.recallId : undefined);
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
    [editor, onChipClick]
  );
  return null;
};
