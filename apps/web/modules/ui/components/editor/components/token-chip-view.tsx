"use client";

import { type ReactNode, createContext, useContext } from "react";
import type { TEditorTokenChip } from "../lib/token-chips";

/**
 * The Editor's `renderTokenChip`. Lexical renders decorators inside the composer's React tree, so a
 * chip reads it from context, and a new renderer (e.g. a survey name that finished loading) redraws
 * every chip without touching the editor's content.
 */
export const TokenChipRendererContext = createContext<((chip: TEditorTokenChip) => ReactNode) | null>(null);

export const TokenChipView = ({ chip }: Readonly<{ chip: TEditorTokenChip }>) => {
  const renderChip = useContext(TokenChipRendererContext);
  const rendered = renderChip?.(chip);
  if (rendered) return rendered;

  return (
    <span
      className="inline-flex h-fit justify-center rounded-md bg-slate-100 px-1 text-sm whitespace-nowrap text-slate-700"
      title={chip.description}
      data-token-chip={chip.token}>
      {chip.label}
    </span>
  );
};
