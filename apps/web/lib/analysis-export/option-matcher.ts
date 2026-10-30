/**
 * Matches a stored answer text to the option it picked (ADR 0015).
 *
 * A response stores the label text the respondent saw, in their language, not an option id. The
 * match is exact on that text: response language first, then any language. Nothing fuzzy decides a
 * code, because a renamed option and an Other write-in look identical in storage. {@link
 * closestOption} is only for the Unmapped values list, where it informs a human and never a cell.
 *
 * Pure: no survey type, no I/O. Options are structural so choices, matrix rows and matrix columns
 * all go through the same matcher.
 */

/** The id Formbricks gives an "Other, please specify" option. */
export const OTHER_OPTION_ID = "other";

export type TMatchableOption = {
  id: string;
  code?: string;
  label: Readonly<Record<string, string>>;
};

export type TOptionResolution<TOption extends TMatchableOption> =
  | { status: "matched"; choice: TOption }
  /** No option matched and the question has an Other option: the text is an Other write-in. */
  | { status: "other"; choice: TOption }
  /** `ambiguous`: the text matched two or more options. `no_match`: it matched none and there is no Other. */
  | { status: "unmapped"; reason: "no_match" | "ambiguous" };

const normalize = (text: string): string => text.normalize("NFC").trim();

const labelsOf = (option: TMatchableOption): string[] =>
  Object.values(option.label)
    .map(normalize)
    .filter((label) => label !== "");

/**
 * @param language `"default"` or a language code, the form `getLanguageCode` returns for a response.
 * The option whose id is {@link OTHER_OPTION_ID} is never matched by its label: its text is what the
 * respondent typed, so a non-match lands there instead.
 */
export const resolveAnswerOption = <TOption extends TMatchableOption>({
  text,
  choices,
  language,
}: {
  text: string;
  choices: readonly TOption[];
  language: string;
}): TOptionResolution<TOption> => {
  const target = normalize(text);
  const other = choices.find((choice) => choice.id === OTHER_OPTION_ID);
  const candidates = choices.filter((choice) => choice.id !== OTHER_OPTION_ID);

  const inLanguage = candidates.filter((choice) => {
    const label = choice.label[language];
    return label !== undefined && normalize(label) === target && target !== "";
  });
  const matches =
    inLanguage.length > 0
      ? inLanguage
      : candidates.filter((choice) => target !== "" && labelsOf(choice).includes(target));

  if (matches.length === 1) return { status: "matched", choice: matches[0] };
  if (matches.length > 1) return { status: "unmapped", reason: "ambiguous" };
  if (other) return { status: "other", choice: other };
  return { status: "unmapped", reason: "no_match" };
};

/** Long texts are compared on their first characters so one pasted essay cannot cost a quadratic table. */
const SIMILARITY_MAX_CHARS = 200;

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
};

const similarityOf = (a: string, b: string): number => {
  const left = a.toLowerCase().slice(0, SIMILARITY_MAX_CHARS);
  const right = b.toLowerCase().slice(0, SIMILARITY_MAX_CHARS);
  const longest = Math.max(left.length, right.length);
  if (longest === 0) return 1;
  const similarity = 1 - levenshtein(left, right) / longest;
  // A cut text still counts its full length, so a 100k-character answer is not "close" to a short label.
  const wasCut = a.length > SIMILARITY_MAX_CHARS || b.length > SIMILARITY_MAX_CHARS;
  return wasCut ? similarity * (Math.min(a.length, b.length) / Math.max(a.length, b.length)) : similarity;
};

/**
 * The option whose label, in any language, is most similar to `text` (case-insensitive,
 * `1 - editDistance / length`, 0 to 1). The Other option is skipped. `null` when there is no option
 * with a label.
 */
export const closestOption = <TOption extends TMatchableOption>(
  text: string,
  choices: readonly TOption[]
): { choice: TOption; similarity: number } | null => {
  const target = normalize(text);
  let best: { choice: TOption; similarity: number } | null = null;
  for (const choice of choices) {
    if (choice.id === OTHER_OPTION_ID) continue;
    for (const label of labelsOf(choice)) {
      const similarity = similarityOf(target, label);
      if (!best || similarity > best.similarity) best = { choice, similarity };
    }
  }
  return best;
};
