import { WORKFLOW_VARIABLE_PATH_PATTERN_SOURCE, findWorkflowRecallTokens } from "@formbricks/workflows";

/**
 * A one-line field that takes Variables (an HTTP query parameter or header value). The definition
 * stores recall tokens (`#recall:payload.customer.id/fallback:#`, ADR 0045); the field shows each as
 * `{{payload.customer.id}}` (`{{path|fallback}}` with a fallback), which reads as a placeholder, can be
 * typed by hand, and maps back exactly. `@` opens the Variable picker, which inserts one.
 */

const DISPLAY_TOKEN = new RegExp(
  String.raw`\{\{(${WORKFLOW_VARIABLE_PATH_PATTERN_SOURCE})(?:\|([^}]*))?\}\}`,
  "g"
);

/** Stored text → what the field shows. */
export const toVariableInputDisplay = (stored: string): string => {
  const tokens = findWorkflowRecallTokens(stored);
  if (tokens.length === 0) return stored;
  let display = "";
  let cursor = 0;
  for (const token of tokens) {
    display += stored.slice(cursor, token.start);
    display += token.rawFallback ? `{{${token.path}|${token.rawFallback}}}` : `{{${token.path}}}`;
    cursor = token.end;
  }
  return display + stored.slice(cursor);
};

/** What the field shows → stored text. Braces around anything but a Variable path stay text. */
export const fromVariableInputDisplay = (display: string): string =>
  display.replaceAll(
    DISPLAY_TOKEN,
    (_match, path: string, fallback: string | undefined) => `#recall:${path}/fallback:${fallback ?? ""}#`
  );

/**
 * The field's text with the `@` just typed before `caret` replaced by a Variable; null when the
 * character before the caret is not `@`. Returns the new text and where the caret goes.
 */
export const insertVariableAtCaret = (
  display: string,
  caret: number,
  path: string
): { display: string; caret: number } | null => {
  if (caret < 1 || display[caret - 1] !== "@") return null;
  const placeholder = `{{${path}}}`;
  return {
    display: display.slice(0, caret - 1) + placeholder + display.slice(caret),
    caret: caret - 1 + placeholder.length,
  };
};
