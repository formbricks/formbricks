/**
 * The Unmapped values sheet (and `unmapped-values.csv`): answers that matched no option, listed so an
 * analyst can fix them. Pure: it reads the service's summary.
 */
import type { TAnalysisCell, TAnalysisExportSummary, TUnmappedValue } from "./types";

export const UNMAPPED_HEADERS = [
  "Column",
  "Question text",
  "Unmapped value",
  "Responses",
  "Languages",
  "Closest option",
  "Closest code",
  "Similarity",
  "Likely cause",
  "Response IDs",
  "Question ID",
] as const;

/** From this similarity up, the answer is the option with its wording changed a little. */
const SLIGHT_DIFFERENCE_FROM = 0.9;

const likelyCause = (closest: TUnmappedValue["closest"]): string =>
  closest && closest.similarity >= SLIGHT_DIFFERENCE_FROM
    ? `wording differs slightly from ${closest.label}`
    : "no similar option";

const toRow = (item: TUnmappedValue): TAnalysisCell[] => [
  item.column,
  item.question.headline,
  item.value,
  item.responseCount,
  item.languages.join(", "),
  item.closest?.label ?? null,
  item.closest?.code ?? null,
  item.closest ? `${Math.round(item.closest.similarity * 100)}%` : null,
  likelyCause(item.closest),
  item.responseIds.join(", ") + (item.responseIdsTruncated ? ", ..." : ""),
  item.question.id,
];

export const buildUnmappedValuesTable = (
  summary: Pick<TAnalysisExportSummary, "unmapped" | "unmappedDropped">
): TAnalysisCell[][] => {
  const rows = summary.unmapped.map(toRow);
  if (summary.unmappedDropped > 0) {
    const note: TAnalysisCell[] = new Array<TAnalysisCell>(UNMAPPED_HEADERS.length).fill(null);
    note[2] = `${summary.unmappedDropped} more unmapped values are not listed.`;
    rows.push(note);
  }
  return rows;
};

/** The columns that hold `UNMAPPED:` cells, for the Datamap note and the SPSS syntax. */
export const unmappedColumnNames = (summary: Pick<TAnalysisExportSummary, "unmapped">): Set<string> =>
  new Set(summary.unmapped.map((item) => item.column));
