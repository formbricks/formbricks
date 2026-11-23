/**
 * A fixed token the editor shows as a chip instead of its text, e.g. a workflow email's
 * `#survey-link#`. The chip serialises back to exactly `token`, so the stored text never changes.
 */
export interface TEditorTokenChip {
  token: string;
  /** What the chip says, e.g. "Survey link". */
  label: string;
  /** Optional tooltip saying what the token becomes. */
  description?: string;
}

export type TTokenTextPart = { kind: "text"; text: string } | { kind: "token"; token: string };

/**
 * A text cut into plain runs and tokens, in order; null when no token occurs, so a caller leaves the
 * text as it is. Empty tokens are ignored.
 */
export const splitTextAtTokens = (text: string, tokens: readonly string[]): TTokenTextPart[] | null => {
  const searched = tokens.filter((token) => token !== "");
  if (searched.length === 0) return null;

  const parts: TTokenTextPart[] = [];
  let cursor = 0;
  let textStart = 0;
  while (cursor < text.length) {
    const token = searched.find((candidate) => text.startsWith(candidate, cursor));
    if (!token) {
      cursor++;
      continue;
    }
    if (cursor > textStart) parts.push({ kind: "text", text: text.slice(textStart, cursor) });
    parts.push({ kind: "token", token });
    cursor += token.length;
    textStart = cursor;
  }
  if (!parts.some((part) => part.kind === "token")) return null;
  if (textStart < text.length) parts.push({ kind: "text", text: text.slice(textStart) });
  return parts;
};
