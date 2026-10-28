import { deriveColumns, isRecord, toViewRow } from "./cells";
import type {
  ListPage,
  ListQuery,
  Parsed,
  RawToolResult,
  ShowResponsesData,
  SortBy,
  ViewColumn,
  ViewRow,
  ViewTotal,
} from "./types";

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const fail = <T>(message: string): Parsed<T> => ({ ok: false, message });

/**
 * What went wrong, in words for the person. A Formbricks tool fails as an `isError` result whose
 * structured content is `{ error: { status, title, detail } }`; a host can also hand back only text.
 */
export const readFailure = (result: RawToolResult | null | undefined): string | undefined => {
  if (!result) return undefined;
  const structured = result.structuredContent;
  const error = isRecord(structured) ? structured.error : undefined;
  if (isRecord(error)) {
    const detail = asString(error.detail) ?? asString(error.title);
    if (detail) return detail;
  }
  if (result.isError) {
    return result.content?.find((block) => block.type === "text")?.text || "The request failed.";
  }
  return undefined;
};

const readTotal = (count: unknown, relation: unknown): ViewTotal | undefined =>
  typeof count === "number" && Number.isFinite(count) && (relation === "eq" || relation === "gte")
    ? { count, relation }
    : undefined;

const readNextCursor = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const readColumn = (value: unknown): ViewColumn | undefined => {
  if (!isRecord(value)) return undefined;
  const id = asString(value.id);
  if (!id) return undefined;
  return {
    id,
    label: asString(value.label) ?? id,
    type: asString(value.type) ?? "unknown",
    position: typeof value.position === "number" ? value.position : Number.MAX_SAFE_INTEGER,
  };
};

const readRow = (value: unknown): ViewRow | undefined => {
  if (!isRecord(value)) return undefined;
  const id = asString(value.id);
  const createdAt = asString(value.createdAt);
  if (!id || !createdAt || typeof value.finished !== "boolean") return undefined;
  const cells: Record<string, string> = {};
  if (isRecord(value.cells)) {
    for (const [key, cell] of Object.entries(value.cells)) {
      if (typeof cell === "string") cells[key] = cell;
    }
  }
  return {
    id,
    createdAt,
    finished: value.finished,
    language: asString(value.language) ?? null,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [],
    cells,
  };
};

const readQuery = (value: unknown): ListQuery | undefined => {
  if (!isRecord(value)) return undefined;
  const workspaceId = asString(value.workspaceId);
  const surveyId = asString(value.surveyId);
  if (!workspaceId || !surveyId) return undefined;
  const sortBy: SortBy = value.sortBy === "createdAt" ? "createdAt" : "-createdAt";
  return {
    workspaceId,
    surveyId,
    limit: typeof value.limit === "number" && value.limit >= 1 ? Math.min(Math.floor(value.limit), 50) : 20,
    sortBy,
    ...(asString(value.contactId) ? { contactId: asString(value.contactId) } : {}),
    ...(Array.isArray(value.language)
      ? { language: value.language.filter((code): code is string => typeof code === "string") }
      : {}),
    ...(asString(value.createdAtGte) ? { createdAtGte: asString(value.createdAtGte) } : {}),
    ...(asString(value.createdAtLte) ? { createdAtLte: asString(value.createdAtLte) } : {}),
    ...(typeof value.finished === "boolean" ? { finished: value.finished } : {}),
  };
};

/** The `show_responses` result, or the reason it cannot be drawn. */
export const parseShowResponses = (result: RawToolResult | null | undefined): Parsed<ShowResponsesData> => {
  const failure = readFailure(result);
  if (failure) return fail(failure);

  const structured = result?.structuredContent;
  if (!isRecord(structured)) return fail("The responses came back in a shape this view cannot read.");

  const survey = isRecord(structured.survey) ? structured.survey : undefined;
  const surveyId = asString(survey?.id);
  const query = readQuery(structured.query);
  if (!surveyId || !query || !Array.isArray(structured.rows) || !Array.isArray(structured.columns)) {
    return fail("The responses came back in a shape this view cannot read.");
  }

  const total = isRecord(structured.total)
    ? readTotal(structured.total.count, structured.total.relation)
    : undefined;
  return {
    ok: true,
    value: {
      survey: { id: surveyId, name: asString(survey?.name) ?? "Responses" },
      query,
      columns: structured.columns
        .map(readColumn)
        .filter((column): column is ViewColumn => column !== undefined),
      rows: structured.rows.map(readRow).filter((row): row is ViewRow => row !== undefined),
      nextCursor: readNextCursor(structured.nextCursor),
      ...(total ? { total } : {}),
    },
  };
};

/** A `list_responses` result, reduced to table rows. */
export const parseListPage = (result: RawToolResult | null | undefined): Parsed<ListPage> => {
  const failure = readFailure(result);
  if (failure) return fail(failure);

  const structured = result?.structuredContent;
  const data = isRecord(structured) ? structured.data : undefined;
  if (!Array.isArray(data)) return fail("The responses came back in a shape this view cannot read.");

  const meta = isRecord(structured) && isRecord(structured.meta) ? structured.meta : undefined;
  const total = readTotal(meta?.totalCount, meta?.totalCountRelation);
  return {
    ok: true,
    value: {
      rows: data.map(toViewRow).filter((row): row is ViewRow => row !== undefined),
      columns: deriveColumns(data),
      nextCursor: readNextCursor(meta?.nextCursor),
      ...(total ? { total } : {}),
    },
  };
};
