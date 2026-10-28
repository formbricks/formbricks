import { isRecord } from "../../shared/guards";
import type { ViewColumn, ViewRow } from "./types";

/** Longest cell text the table keeps. The full answer is one click away in the detail panel. */
export const CELL_MAX_CHARS = 280;
/** Longest single value the detail panel renders. Free text can be arbitrarily long. */
export const DETAIL_VALUE_MAX_CHARS = 4000;
/** Most list entries (selections, matrix rows, fields) one answer renders. */
export const MAX_ANSWER_ENTRIES = 50;

type UnknownRecord = Record<string, unknown>;

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const asRecords = (value: unknown): UnknownRecord[] => (Array.isArray(value) ? value.filter(isRecord) : []);

/** Cut to `max` characters with an ellipsis, without splitting a surrogate pair. */
export const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text;
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
};

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();

const nonEmpty = (value: string | undefined): value is string => value !== undefined && value.trim() !== "";

const selectionLabel = (selection: UnknownRecord): string =>
  asString(selection.optionLabel) ?? asString(selection.rawValue) ?? "";

/**
 * An answer as display lines, one per entry (a selection, a matrix row, an address field). Written for
 * untrusted data: every field is read defensively and an unknown shape yields no lines, never a throw.
 * Lines are capped so a hostile or huge answer cannot blow up the DOM; `capLines` marks the cut.
 */
export const answerToLines = (answer: UnknownRecord): string[] => {
  const lines: string[] = [];
  const type = asString(answer.elementType);

  if (typeof answer.valueText === "string") lines.push(answer.valueText);
  else if (typeof answer.valueNumber === "number") {
    const range = isRecord(answer.range) ? answer.range : undefined;
    const max = typeof range?.max === "number" ? range.max : undefined;
    lines.push(
      max !== undefined && type !== "nps" ? `${answer.valueNumber} / ${max}` : String(answer.valueNumber)
    );
  } else if (typeof answer.valueBoolean === "boolean") {
    if (type === "cta") lines.push(answer.valueBoolean ? "Clicked" : "Skipped");
    else lines.push(answer.valueBoolean ? "Accepted" : "Not accepted");
  } else if (typeof answer.valueDate === "string") lines.push(answer.valueDate);
  else if (typeof answer.booked === "boolean") lines.push(answer.booked ? "Booked" : "Not booked");
  else if (Array.isArray(answer.fileUrls)) {
    const count = typeof answer.fileCount === "number" ? answer.fileCount : answer.fileUrls.length;
    lines.push(count === 1 ? "1 file" : `${count} files`);
  } else if (Array.isArray(answer.selections)) {
    const selections = asRecords(answer.selections);
    const ranked = selections.some((selection) => typeof selection.rank === "number");
    const ordered = ranked
      ? [...selections].sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0))
      : selections;
    for (const [index, selection] of ordered.entries()) {
      const label = selectionLabel(selection);
      if (label !== "") lines.push(ranked ? `${index + 1}. ${label}` : label);
    }
  } else if (Array.isArray(answer.rows)) {
    for (const row of asRecords(answer.rows)) {
      const rowLabel = asString(row.rowLabel) ?? asString(row.rawKey) ?? "";
      const value = asString(row.columnLabel) ?? asString(row.rawValue) ?? "";
      lines.push(rowLabel === "" ? value : `${rowLabel}: ${value}`);
    }
  } else if (Array.isArray(answer.fields)) {
    for (const field of asRecords(answer.fields)) {
      const value = asString(field.valueText);
      if (!nonEmpty(value)) continue;
      const label = asString(field.fieldLabel);
      lines.push(nonEmpty(label) ? `${label}: ${value}` : value);
    }
  }

  return capLines(lines);
};

const capLines = (lines: string[]): string[] =>
  lines.length > MAX_ANSWER_ENTRIES
    ? [...lines.slice(0, MAX_ANSWER_ENTRIES), `and ${lines.length - MAX_ANSWER_ENTRIES} more`]
    : lines;

/** The table cell for an answer: its lines on one line, whitespace collapsed, capped. */
export const answerToCell = (answer: UnknownRecord): string =>
  truncate(collapseWhitespace(answerToLines(answer).join(", ")), CELL_MAX_CHARS);

export const toViewColumn = (answer: UnknownRecord): ViewColumn | undefined => {
  const id = asString(answer.elementId);
  if (!id) return undefined;
  return {
    id,
    label: asString(answer.elementLabel) ?? id,
    type: asString(answer.elementType) ?? "unknown",
    position: typeof answer.position === "number" ? answer.position : Number.MAX_SAFE_INTEGER,
  };
};

/** A `list_responses` item as a table row, or `undefined` when it does not look like a response. */
export const toViewRow = (item: unknown): ViewRow | undefined => {
  if (!isRecord(item)) return undefined;
  const id = asString(item.id);
  const createdAt = asString(item.createdAt);
  if (!id || !createdAt || typeof item.finished !== "boolean") return undefined;

  const cells: Record<string, string> = {};
  for (const answer of asRecords(item.answers)) {
    const columnId = asString(answer.elementId);
    if (!columnId) continue;
    const cell = answerToCell(answer);
    if (cell !== "") cells[columnId] = cell;
  }

  return {
    id,
    createdAt,
    finished: item.finished,
    language: asString(item.language) ?? null,
    tags: asRecords(item.tags)
      .map((tag) => asString(tag.name))
      .filter(nonEmpty),
    cells,
  };
};

/** The questions the answers of these items belong to, in survey order. */
export const deriveColumns = (items: unknown[]): ViewColumn[] => {
  const columns: ViewColumn[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    for (const answer of asRecords(item.answers)) {
      const column = toViewColumn(answer);
      if (column) columns.push(column);
    }
  }
  return mergeColumns([], columns);
};

/**
 * Union of two column lists, ordered by survey position. Existing columns win on a clash so a label does
 * not change under the reader's eyes; the sort is stable, so equal positions keep their arrival order.
 */
export const mergeColumns = (existing: ViewColumn[], incoming: ViewColumn[]): ViewColumn[] => {
  const known = new Set(existing.map((column) => column.id));
  const merged = [...existing];
  for (const column of incoming) {
    if (known.has(column.id)) continue;
    known.add(column.id);
    merged.push(column);
  }
  return merged
    .map((column, index) => ({ column, index }))
    .sort((a, b) => a.column.position - b.column.position || a.index - b.index)
    .map(({ column }) => column);
};

/** Append a page of rows, skipping any the list already holds (a response can arrive on two pages). */
export const mergeRows = (existing: ViewRow[], incoming: ViewRow[]): ViewRow[] => {
  const known = new Set(existing.map((row) => row.id));
  return [...existing, ...incoming.filter((row) => !known.has(row.id))];
};
