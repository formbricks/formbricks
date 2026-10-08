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
  /**
   * Whether the import cut the question (to fit the create's body, or because the create refused
   * it). A pipe to one shows the recall fallback rather than nothing: the question existed, and the
   * text around the pipe still expects an answer there.
   */
  cutQuestion: (ref: string) => boolean;
}

const recallToken = (id: string): string => `#recall:${id}/fallback:${QSF_RECALL_FALLBACK}#`;

/**
 * Stand-ins for the recall tokens this import writes, while file text around them is made safe. From
 * Unicode's private use area, and removed from the text first, so the file cannot forge one.
 */
const PLACEHOLDER_START = "\uE000";
const PLACEHOLDER_END = "\uE001";
const PLACEHOLDER_PATTERN = /\uE000(\d+)\uE001/g;

/**
 * Qualtrics piped text → Formbricks recall. `${q://QID3/…}` recalls the element QID3 became, when that
 * element is in an earlier block, and shows the recall fallback (`QSF_RECALL_FALLBACK`) when the import
 * cut QID3; `${e://Field/name}` recalls the hidden field the name became; every other pipe (`lm://`,
 * `rand://`, `date://`, a later question) has no equivalent and is removed. A pipe not turned into a
 * recall counts in `removed`.
 *
 * Any `#recall:` left in the text afterwards is the file's own, and is broken up: whether it was there
 * from the start or formed when a pipe between its letters was removed (`#rec${lm://x}all:…`), it must
 * not become a live reference with a fallback the file wrote. The import's own tokens sit behind
 * placeholders meanwhile, and file text that would run on from one of them (`…#recall:…`) is broken
 * up too.
 *
 * In a text that does not render recall (a choice label), the context recalls nothing, so every pipe
 * is removed but one to a cut question, which shows the fallback.
 */
export function replacePipedText(
  text: string,
  context: TPipedTextContext | null
): { text: string; removed: number } {
  if (!text.includes("${") && !text.includes("#recall:")) return { text, removed: 0 };

  let removed = 0;
  const tokens: string[] = [];
  const placeholder = (token: string) => {
    tokens.push(token);
    return `${PLACEHOLDER_START}${tokens.length - 1}${PLACEHOLDER_END}`;
  };

  let replaced = text
    .replaceAll(PLACEHOLDER_START, "")
    .replaceAll(PLACEHOLDER_END, "")
    .replaceAll(PIPED_TEXT_PATTERN, (_token: string, scheme: string, body: string) => {
      if (context && scheme === "q") {
        const ref = body.split("/")[0];
        const id = context.recallElement(ref);
        if (id) return placeholder(recallToken(id));
        if (context.cutQuestion(ref)) {
          removed += 1;
          return QSF_RECALL_FALLBACK;
        }
      } else if (context && scheme === "e") {
        const [kind, name] = body.split("/");
        const id = kind === "Field" && name ? context.hiddenField(name) : null;
        if (id) return placeholder(recallToken(id));
      }
      removed += 1;
      return "";
    });

  if (removed > 0) replaced = replaced.replaceAll(/ {2,}/g, " ").trim();
  replaced = replaced
    .replaceAll("#recall:", "# recall:")
    // Our token ends with `#`: file text starting `recall:` right after it would read as another one.
    .replaceAll(`${PLACEHOLDER_END}recall:`, `${PLACEHOLDER_END} recall:`)
    .replaceAll(PLACEHOLDER_PATTERN, (_match: string, index: string) => tokens[Number(index)] ?? "");

  return { text: replaced, removed };
}
