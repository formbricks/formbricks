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
