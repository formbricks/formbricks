import type { TCustomCssInput } from "@formbricks/types/custom-css";

const normalizeField = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * The comparable form of custom CSS input, for change detection (Scale checks, "unchanged" writes):
 * each field trimmed, a field that trims to empty becomes `null`, and no CSS at all becomes `null`.
 *
 * Kept free of the processor's native dependency so client code can import it from this file directly.
 * Process the creator's untrimmed fields, not this, when line and column numbers have to match the editor.
 */
export const normalizeCustomCssInput = (
  input: TCustomCssInput | null | undefined
): TCustomCssInput | null => {
  if (!input) return null;
  const light = normalizeField(input.light);
  const dark = normalizeField(input.dark);
  return light === null && dark === null ? null : { light, dark };
};
