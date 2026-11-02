import type { TExportColumnGroup } from "./column-selection";
import type { TAnalysisColumn, TAnalysisExport, TAnalysisRow } from "./types";

/** What the Include columns list calls the response columns an Analysis export always has. */
const RESPONSE_COLUMN_LABELS: Record<string, string> = {
  response_id: "responseId",
  user_id: "userId",
  contact_id: "contactId",
  verified_email: "verifiedEmail",
};

/** The Include columns entry a column belongs to: a question's columns go together, so do its options and the metadata fields. */
export const analysisColumnGroupId = (column: TAnalysisColumn): string => {
  if (column.source === "question" && column.question) return `q:${column.question.id}`;
  // The reserved metadata fields and the contact attributes are one entry each, as in the Standard list.
  if (column.source === "embedded" && column.embedded?.origin === "metadata") return "metadata";
  if (column.source === "embedded" && column.embedded?.origin === "contact") return "person";
  if (column.source === "embedded") return `e:${column.name}`;
  return `r:${column.name}`;
};

/**
 * The multi-select questions written as one 1/0 column per option: only those list their options. One written
 * as a single cell (`1; 4`) is one entry, like any other question.
 */
const questionsWithOptionColumns = (columns: readonly TAnalysisColumn[]): ReadonlySet<string> =>
  new Set(
    columns.flatMap((column) =>
      column.kind === "flag" && column.question?.type === "multipleChoiceMulti" ? [column.question.id] : []
    )
  );

/** The entry of a multi-select option or Other text column, listed under its question. Other columns have none. */
const analysisColumnOptionId = (
  column: TAnalysisColumn,
  optionQuestions: ReadonlySet<string>
): string | null =>
  column.source === "question" && column.question && optionQuestions.has(column.question.id)
    ? `c:${column.name}`
    : null;

/** How many columns each entry holds, for sizing a workbook after some entries are switched off. */
export const columnsByEntry = (columns: readonly TAnalysisColumn[]): Record<string, number> => {
  const optionQuestions = questionsWithOptionColumns(columns);
  const counts: Record<string, number> = {};
  for (const column of columns) {
    const id = analysisColumnOptionId(column, optionQuestions) ?? analysisColumnGroupId(column);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

const optionLabel = (column: TAnalysisColumn): string => {
  const label = column.option?.label ?? column.name;
  const shown = column.kind === "other_text" ? `${label} (text)` : label;
  return `${column.name} · ${shown}`;
};

const groupLabel = (column: TAnalysisColumn): string => {
  if (column.source === "question" && column.question) {
    return `${column.question.code} · ${column.question.headline}`;
  }
  if (column.source === "embedded" && column.embedded?.origin === "metadata") return "metadata";
  if (column.source === "embedded" && column.embedded?.origin === "contact") return "person";
  if (column.source === "embedded") return column.embedded?.label ?? column.name;
  return RESPONSE_COLUMN_LABELS[column.name] ?? column.name;
};

/** The Include columns list of an Analysis export, in column order. A multi-select lists its options too. */
export const analysisColumnGroups = (columns: readonly TAnalysisColumn[]): TExportColumnGroup[] => {
  const optionQuestions = questionsWithOptionColumns(columns);
  const groups = new Map<string, TExportColumnGroup>();
  for (const column of columns) {
    const id = analysisColumnGroupId(column);
    if (!groups.has(id)) groups.set(id, { id, label: groupLabel(column) });
    const optionId = analysisColumnOptionId(column, optionQuestions);
    if (optionId) groups.set(optionId, { id: optionId, label: optionLabel(column), parentId: id });
  }
  return [...groups.values()];
};

/**
 * The export without the columns of the switched-off groups and options. The Datamap and the SPSS syntax read
 * `columns`, so they follow; the Unmapped values keep listing what the answers held.
 */
export const withoutColumnGroups = (
  exported: TAnalysisExport,
  excluded: readonly string[]
): TAnalysisExport => {
  if (excluded.length === 0) return exported;
  const optionQuestions = questionsWithOptionColumns(exported.columns);
  const keep = exported.columns.map(
    (column) =>
      !excluded.includes(analysisColumnGroupId(column)) &&
      !excluded.includes(analysisColumnOptionId(column, optionQuestions) ?? "")
  );
  const pick = <T>(cells: T[] | null): T[] | null => (cells ? cells.filter((_, index) => keep[index]) : null);
  return {
    ...exported,
    columns: exported.columns.filter((_, index) => keep[index]),
    rows: async function* () {
      for await (const batch of exported.rows()) {
        yield batch.map(
          (row): TAnalysisRow => ({ ...row, codes: pick(row.codes), labels: pick(row.labels) })
        );
      }
    },
  };
};
