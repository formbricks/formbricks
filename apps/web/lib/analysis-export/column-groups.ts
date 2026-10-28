import type { TExportColumnGroup } from "./column-selection";
import type { TAnalysisColumn, TAnalysisExport, TAnalysisRow } from "./types";

/** What the Include columns list calls the response columns an Analysis export always has. */
const RESPONSE_COLUMN_LABELS: Record<string, string> = {
  response_id: "responseId",
  user_id: "userId",
  contact_id: "contactId",
  verified_email: "verifiedEmail",
};

/** The Include columns entry a column belongs to: a question's columns go together, so do its options. */
export const analysisColumnGroupId = (column: TAnalysisColumn): string => {
  if (column.source === "question" && column.question) return `q:${column.question.id}`;
  if (column.source === "embedded") return `e:${column.name}`;
  return `r:${column.name}`;
};

const groupLabel = (column: TAnalysisColumn): string => {
  if (column.source === "question" && column.question) {
    return `${column.question.code} · ${column.question.headline}`;
  }
  if (column.source === "embedded") return column.embedded?.label ?? column.name;
  return RESPONSE_COLUMN_LABELS[column.name] ?? column.name;
};

/** The Include columns list of an Analysis export, in column order. */
export const analysisColumnGroups = (columns: readonly TAnalysisColumn[]): TExportColumnGroup[] => {
  const groups = new Map<string, TExportColumnGroup>();
  for (const column of columns) {
    const id = analysisColumnGroupId(column);
    if (!groups.has(id)) groups.set(id, { id, label: groupLabel(column) });
  }
  return [...groups.values()];
};

/**
 * The export without the columns of the switched-off groups. The Datamap and the SPSS syntax read
 * `columns`, so they follow; the Unmapped values keep listing what the answers held.
 */
export const withoutColumnGroups = (
  exported: TAnalysisExport,
  excluded: readonly string[]
): TAnalysisExport => {
  if (excluded.length === 0) return exported;
  const keep = exported.columns.map((column) => !excluded.includes(analysisColumnGroupId(column)));
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
