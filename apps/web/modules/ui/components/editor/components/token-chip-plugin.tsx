"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { registerTokenChipTransform } from "../lib/token-chip-transform";
import type { TEditorTokenChip } from "../lib/token-chips";

/** Shows the given tokens as chips (see `TEditorTokenChip`). */
export const TokenChipPlugin = ({ chips }: Readonly<{ chips: readonly TEditorTokenChip[] }>) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => registerTokenChipTransform(editor, chips), [editor, chips]);

  return null;
};
