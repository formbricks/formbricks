import { type TMatchableOption, closestOption } from "./option-matcher";
import type { TUnmappedValue } from "./types";

/** Response ids kept per (column, value). The count stays exact; the id list says when it was cut. */
export const UNMAPPED_RESPONSE_IDS_CAP = 500;
/** Distinct (column, value) pairs kept. Free text in a select column cannot grow the list without bound. */
export const UNMAPPED_DISTINCT_CAP = 5000;

type TOccurrence = {
  column: string;
  question: TUnmappedValue["question"];
  value: string;
  reason: TUnmappedValue["reason"];
  /** What the closest option is searched in, taken once per entry. */
  options: readonly TMatchableOption[];
  languages: Set<string>;
  responseCount: number;
  responseIds: string[];
  idsTruncated: boolean;
};

/**
 * Collects the Unmapped values in the same pass that builds the rows: one entry per (column, value),
 * with the number of responses, their languages and ids. Similarity is computed once per distinct
 * entry at the end, not once per response.
 */
export const createUnmappedCollector = () => {
  const entries = new Map<string, TOccurrence>();
  let dropped = 0;

  const add = (input: {
    column: string;
    question: TUnmappedValue["question"];
    value: string;
    reason: TUnmappedValue["reason"];
    options: TOccurrence["options"];
    language: string;
    responseId: string;
  }): void => {
    const key = `${input.column}\u0000${input.value}`;
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= UNMAPPED_DISTINCT_CAP) {
        dropped++;
        return;
      }
      entry = {
        column: input.column,
        question: input.question,
        value: input.value,
        reason: input.reason,
        options: input.options,
        languages: new Set(),
        responseCount: 0,
        responseIds: [],
        idsTruncated: false,
      };
      entries.set(key, entry);
    }
    // A response counts once per entry even if a multi-select holds the same text twice.
    if (entry.responseIds.at(-1) === input.responseId) return;
    entry.responseCount++;
    entry.languages.add(input.language);
    if (entry.responseIds.length < UNMAPPED_RESPONSE_IDS_CAP) entry.responseIds.push(input.responseId);
    else entry.idsTruncated = true;
  };

  const result = (): { unmapped: TUnmappedValue[]; dropped: number } => {
    const unmapped = [...entries.values()].map((entry): TUnmappedValue => {
      const closest = entry.reason === "not_a_number" ? null : closestOption(entry.value, entry.options);
      return {
        column: entry.column,
        question: entry.question,
        value: entry.value,
        responseCount: entry.responseCount,
        languages: [...entry.languages].sort(),
        closest: closest
          ? {
              code: closest.choice.code ?? null,
              label: closest.choice.label.default ?? Object.values(closest.choice.label)[0] ?? "",
              similarity: Math.round(closest.similarity * 100) / 100,
            }
          : null,
        reason: entry.reason,
        responseIds: entry.responseIds,
        responseIdsTruncated: entry.idsTruncated,
      };
    });
    unmapped.sort(
      (a, b) =>
        a.column.localeCompare(b.column, "en") ||
        b.responseCount - a.responseCount ||
        a.value.localeCompare(b.value, "en")
    );
    return { unmapped, dropped };
  };

  return { add, result };
};
