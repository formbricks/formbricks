import type { TV3ResponseAnswer, TV3ResponseListItem } from "@/app/api/v3/responses/lib/resources";
import type { TMcpShowResponsesInput } from "./schemas";

/** Longest cell text sent to the view. The full answer is one `get_response` call away. */
export const CELL_MAX_CHARS = 280;
/** Most entries (selections, matrix rows, fields) one answer contributes to a cell. */
const MAX_ANSWER_ENTRIES = 50;
/** Longest survey name quoted in the text the model reads. */
const NAME_MAX_CHARS = 80;

/** Cut to `max` characters with an ellipsis, without splitting a surrogate pair. */
export const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text;
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
};

const collapseWhitespace = (text: string): string => text.replaceAll(/\s+/g, " ").trim();

/**
 * One answer as display lines. Mirrors `answerToLines` in `packages/mcp-views/src/views/responses/cells.ts`
 * (which reads the same data defensively, because it also formats pages it receives from the host);
 * the table must read the same whether a row arrived in this result or on a later page.
 */
export const answerToLines = (answer: TV3ResponseAnswer): string[] => {
  const lines = ((): string[] => {
    switch (answer.elementType) {
      case "openText":
        return [answer.valueText];
      case "nps":
        return [String(answer.valueNumber)];
      case "rating":
      case "csat":
      case "ces":
        return [`${answer.valueNumber} / ${answer.range.max}`];
      case "consent":
        return [answer.valueBoolean ? "Accepted" : "Not accepted"];
      case "cta":
        return [answer.valueBoolean ? "Clicked" : "Skipped"];
      case "date":
        return [answer.valueDate];
      case "cal":
        return [answer.booked ? "Booked" : "Not booked"];
      case "fileUpload": {
        const count = answer.fileCount ?? answer.fileUrls.length;
        return [count === 1 ? "1 file" : `${count} files`];
      }
      case "multipleChoiceSingle":
      case "multipleChoiceMulti":
      case "pictureSelection":
      case "ranking": {
        const ranked = answer.selections.some((selection) => selection.rank !== undefined);
        const ordered = ranked
          ? answer.selections.toSorted((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
          : answer.selections;
        return ordered.flatMap((selection, index) => {
          const label = selection.optionLabel ?? selection.rawValue;
          if (label === "") return [];
          return [ranked ? `${index + 1}. ${label}` : label];
        });
      }
      case "matrix":
        return answer.rows.map((row) => {
          const value = row.columnLabel ?? row.rawValue;
          return row.rowLabel === "" ? value : `${row.rowLabel}: ${value}`;
        });
      case "address":
      case "contactInfo":
        return answer.fields.flatMap((field) =>
          field.valueText.trim() === "" ? [] : [`${field.fieldLabel}: ${field.valueText}`]
        );
    }
  })();

  return lines.length > MAX_ANSWER_ENTRIES
    ? [...lines.slice(0, MAX_ANSWER_ENTRIES), `and ${lines.length - MAX_ANSWER_ENTRIES} more`]
    : lines;
};

export const answerToCell = (answer: TV3ResponseAnswer): string =>
  truncate(collapseWhitespace(answerToLines(answer).join(", ")), CELL_MAX_CHARS);

export type TShowResponsesColumn = { id: string; label: string; type: string; position: number };

/** The questions these responses answered, once each, in survey order. */
export const deriveColumns = (items: readonly TV3ResponseListItem[]): TShowResponsesColumn[] => {
  const columns = new Map<string, TShowResponsesColumn>();

  for (const item of items) {
    for (const answer of item.answers) {
      if (columns.has(answer.elementId)) continue;
      columns.set(answer.elementId, {
        id: answer.elementId,
        label: answer.elementLabel,
        type: answer.elementType,
        position: answer.position,
      });
    }
  }

  return [...columns.values()].toSorted((a, b) => a.position - b.position);
};

export const toRow = (item: TV3ResponseListItem) => {
  const cells: Record<string, string> = {};
  for (const answer of item.answers) {
    const cell = answerToCell(answer);
    if (cell !== "") cells[answer.elementId] = cell;
  }

  return {
    id: item.id,
    createdAt: item.createdAt,
    finished: item.finished,
    language: item.language,
    tags: item.tags.map((tag) => tag.name),
    cells,
  };
};

type TListMeta = {
  nextCursor: string | null;
  totalCount: number | null;
  totalCountRelation: "eq" | "gte" | null;
};

/** The arguments the view re-sends to `list_responses` on every follow-up page and filter change. */
const toQuery = (input: TMcpShowResponsesInput) => ({
  workspaceId: input.workspaceId,
  surveyId: input.surveyId,
  limit: input.limit,
  sortBy: input.sortBy,
  ...(input.contactId ? { contactId: input.contactId } : {}),
  ...(input.language ? { language: input.language } : {}),
  ...(input.createdAtGte ? { createdAtGte: input.createdAtGte } : {}),
  ...(input.createdAtLte ? { createdAtLte: input.createdAtLte } : {}),
  ...(input.finished === undefined ? {} : { finished: input.finished }),
});

/** `structuredContent` of `show_responses`: what the view renders from. */
export const buildShowResponsesPayload = (
  input: TMcpShowResponsesInput,
  items: readonly TV3ResponseListItem[],
  meta: TListMeta
) => ({
  survey: { id: input.surveyId, ...(items[0] ? { name: items[0].surveyName } : {}) },
  query: toQuery(input),
  columns: deriveColumns(items),
  rows: items.map(toRow),
  nextCursor: meta.nextCursor,
  ...(meta.totalCount !== null && meta.totalCountRelation !== null
    ? { total: { count: meta.totalCount, relation: meta.totalCountRelation } }
    : {}),
});

const dayOf = (iso: string): string => iso.slice(0, 10);

/**
 * `content` for the model: how much is on screen and how to read more, never the answers themselves —
 * the person has the table, and the model can call `list_responses` when it needs the data. The survey
 * name is respondent-adjacent free text, so it is flattened and capped before it is quoted.
 */
export const buildShowResponsesText = (
  input: TMcpShowResponsesInput,
  items: readonly TV3ResponseListItem[],
  meta: TListMeta
): string => {
  const name = items[0] ? truncate(collapseWhitespace(items[0].surveyName), NAME_MAX_CHARS) : undefined;
  const survey = name ? `survey "${name}" (${input.surveyId})` : `survey ${input.surveyId}`;

  if (items.length === 0) {
    return `No responses match for ${survey}. The person is looking at an empty table with filters they can change.`;
  }

  const total =
    meta.totalCount === null
      ? ""
      : ` of ${meta.totalCountRelation === "gte" ? "at least " : ""}${meta.totalCount}`;
  const finished = items.filter((item) => item.finished).length;
  const days = items.map((item) => dayOf(item.createdAt)).toSorted((a, b) => a.localeCompare(b));
  const range = days[0] === days.at(-1) ? `on ${days[0]}` : `from ${days[0]} to ${days.at(-1)}`;
  const order = input.sortBy === "createdAt" ? "oldest first" : "newest first";

  return [
    `Showing ${items.length}${total} responses to ${survey}, ${order}, created ${range} (UTC).`,
    `${finished} finished, ${items.length - finished} partial.`,
    meta.nextCursor
      ? "More are available; the view loads them on request."
      : "That is every matching response.",
    "The person is looking at an interactive table with filters and a detail panel, so do not repeat the rows.",
    "To read or analyse the answers yourself, call list_responses or get_response.",
  ].join(" ");
};
