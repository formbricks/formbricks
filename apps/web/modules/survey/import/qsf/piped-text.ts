/**
 * Qualtrics piped text: `${q://QID3/ChoiceTextEntryValue}`, `${e://Field/firstName}`, `${lm://…}`.
 *
 * The body is bounded (`{0,200}`) so a long run of `${x://` with no closing brace costs a bounded scan
 * per occurrence instead of a scan to the end of the text from each one.
 */
export const PIPED_TEXT_PATTERN = /\$\{([a-zA-Z]{1,10}):\/\/([^}]{0,200})\}/g;

/** The embedded data names a text pipes in (`${e://Field/<name>}`). */
export function collectEmbeddedDataReferences(text: string): string[] {
  if (!text.includes("${e://")) return [];
  const names: string[] = [];
  for (const match of text.matchAll(PIPED_TEXT_PATTERN)) {
    if (match[1] !== "e") continue;
    const [kind, name] = match[2].split("/");
    if (kind === "Field" && name) names.push(name);
  }
  return names;
}

/**
 * What a recall shows when the answer it recalls is empty. Fixed, never text from the file: the editor
 * refuses an empty fallback, `#` would end the token, and a space would be stored as `nbsp`.
 */
export const QSF_RECALL_FALLBACK = "...";

export interface TPipedTextContext {
  /** The element id a `${q://QIDx/…}` may recall, or `null` when it may not (not earlier, not imported). */
  recallElement: (ref: string) => string | null;
  /** The hidden field id an embedded data name became, or `null`. */
  hiddenField: (name: string) => string | null;
}

const recallToken = (id: string): string => `#recall:${id}/fallback:${QSF_RECALL_FALLBACK}#`;

/**
 * Qualtrics piped text → Formbricks recall. `${q://QID3/…}` recalls the element QID3 became, when that
 * element is in an earlier block; `${e://Field/name}` recalls the hidden field the name became; every
 * other pipe (`lm://`, `rand://`, `date://`, a later question) has no equivalent and is removed.
 *
 * A `#recall:` already in the text is broken up first: it is the file's text, and must not become a
 * live reference.
 *
 * Without a context (choice labels, which do not render recall) every pipe is removed.
 */
export function replacePipedText(
  text: string,
  context: TPipedTextContext | null
): { text: string; removed: number } {
  if (!text.includes("${") && !text.includes("#recall:")) return { text, removed: 0 };

  let removed = 0;
  const replaced = text
    .replaceAll("#recall:", "# recall:")
    .replaceAll(PIPED_TEXT_PATTERN, (_token: string, scheme: string, body: string) => {
      if (context && scheme === "q") {
        const id = context.recallElement(body.split("/")[0]);
        if (id) return recallToken(id);
      } else if (context && scheme === "e") {
        const [kind, name] = body.split("/");
        const id = kind === "Field" && name ? context.hiddenField(name) : null;
        if (id) return recallToken(id);
      }
      removed += 1;
      return "";
    });

  return { text: removed > 0 ? replaced.replaceAll(/ {2,}/g, " ").trim() : replaced, removed };
}
