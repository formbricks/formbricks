import { hasChipSeparator, splitChipInput } from "@/modules/ui/components/tags-combobox/lib/chips";

/**
 * How typed text in a creatable `MultiSelect` with `splitOnSeparators` becomes values (ENG-7248): a comma,
 * semicolon or line break ends a value, and what follows the last one is still being typed. Kept out of
 * the component so it is unit-tested; the component only adds `commit` as chips and keeps `rest`.
 */
export const splitTypedInput = (text: string): { commit: string[]; rest: string } => {
  if (!hasChipSeparator(text)) return { commit: [], rest: text };
  const parts = text.split(/[,;\n\r\t]/);
  const rest = parts.pop() ?? "";
  return { commit: splitChipInput(parts.join(",")), rest: rest.trimStart() };
};

/**
 * Pasted text with a separator becomes values at once, together with the typed text around it; `null`
 * when the paste holds no separator and should go into the input as text. The paste replaces the input's
 * selection (`selectionStart`–`selectionEnd`, the caret at the end by default), as a native paste would.
 */
export const splitPastedInput = (
  typed: string,
  pasted: string,
  selectionStart: number = typed.length,
  selectionEnd: number = selectionStart
): string[] | null =>
  hasChipSeparator(pasted)
    ? splitChipInput(`${typed.slice(0, selectionStart)}${pasted}${typed.slice(selectionEnd)}`)
    : null;
