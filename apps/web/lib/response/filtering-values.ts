import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { getComputedEmbeddedFields, getIngestedStorageKeys } from "@formbricks/types/embedded-data-resolver";
import type { TEmbeddedValueResponse } from "@formbricks/types/embedded-data-resolver";
import type {
  TResponse,
  TResponseHiddenFieldsFilter,
  TSurveyContactAttributes,
  TSurveyMetaFieldFilter,
} from "@formbricks/types/responses";
import type { TResponseNotShown } from "@formbricks/types/surveys/not-shown";
import { type TOptionListKey, getOptionLists } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  MAX_FILTER_VALUE_OPTIONS,
  getResponseContactAttributes,
  getResponseHiddenFields,
  getResponseMeta,
  getResponseReservedFilterValues,
  getResponseVariableFilterValues,
} from "./utils";

/**
 * The option lists the response filter offers (ENG-3755).
 *
 * Freshness: there is no cache. The values are computed on every filter-menu open, as before, but
 * each query below returns one row per DISTINCT value instead of one full row (`data`, `ttc`, …) per
 * response. What reaches Node is bounded by the number of distinct values, not by the response count.
 * That is not a hard bound: for keys that differ per response (`ipAddress`, `pageReferrer`, a contact
 * email) it is still about one row per response, and Postgres still scans every response of the
 * survey. Only the variables query caps in SQL; capping the others would change which options the
 * filter offers today, so it is left to a search/pagination follow-up.
 *
 * Every value comes back as its jsonb text (`value::text`) and is `JSON.parse`d here, which yields the
 * exact JS value the old `findMany` handed the helpers. Each distinct value is then wrapped in a
 * one-path response slice and fed through the same helpers as before (`getResponseMeta`,
 * `getResponseReservedFilterValues`, …), so stringification, redaction, gating and the
 * `MAX_FILTER_VALUE_OPTIONS` cap keep one definition. That is sound because each helper derives every
 * option from a single path of a single response and dedupes into a Set. The one assumption it adds —
 * every string-typed reserved filter entry reads one `meta` path — is pinned by a guard test.
 *
 * Rows are ordered so the cap keeps the same 50 values on every open; the old row order was whatever
 * order Postgres returned the responses in.
 */

/** A jsonb scalar's canonical JSON text, distinct per key. */
export interface TFilterValueRow {
  key: string;
  value: string;
}

/** A meta value: top-level (`nestedKey` null) or one level down (`userAgent.browser`). */
export interface TMetaFilterValueRow extends TFilterValueRow {
  nestedKey: string | null;
}

type TFilterValueSlice = Pick<TResponse, "contactAttributes" | "data" | "meta">;

/** `column` when it holds a jsonb object, else `{}`, so `jsonb_each` never sees a scalar or array. */
const jsonbObjectOrEmpty = (column: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`CASE WHEN jsonb_typeof(${column}) = 'object' THEN ${column} ELSE '{}'::jsonb END`;

const CONTACT_ATTRIBUTES = Prisma.raw(`r."contactAttributes"`);
const META = Prisma.raw("r.meta");
const META_VALUE = Prisma.raw("m.value");

/**
 * Distinct contact attribute values. A jsonb `null` value is skipped: the schema stores strings only,
 * and `getResponseContactAttributes` calls `.toString()` on each value, which threw on `null` and
 * failed the whole filter load.
 */
const queryContactAttributeValues = (surveyId: string): Promise<TFilterValueRow[]> =>
  prisma.$queryRaw<TFilterValueRow[]>`
    SELECT DISTINCT a.key AS "key", a.value::text AS "value"
    FROM "Response" r
    CROSS JOIN LATERAL jsonb_each(${jsonbObjectOrEmpty(CONTACT_ATTRIBUTES)}) AS a
    WHERE r."surveyId" = ${surveyId}
      AND jsonb_typeof(a.value) <> 'null'
    ORDER BY 1, 2
  `;

/**
 * Distinct scalar meta values, top-level and one level down (arrays by index, which is what the old
 * `Object.entries` walk produced for them).
 *
 * `url` is the one key cut DB-side: `getResponseMeta` only needs to know the key exists, and the
 * reserved `url` entry is `redactQuery`, so only origin + path survive. Cutting after the first `?` or
 * `#` (keeping the separator, so the URL parser still sees where the path ends) collapses per-response
 * query strings — a single-use token, a tracking id — before they cost a row. `redactUrlQuery` still
 * runs on the result. `pageReferrer` and `visitEntryReferrer` are not cut: `getResponseMeta` returns
 * their raw values today.
 *
 * Two branches rather than one lateral per meta key: the nested walk then runs only for object/array
 * values (`userAgent`), which keeps the plan parallel. The single-lateral form was ~6x slower on 50k
 * responses.
 */
const queryMetaValues = (surveyId: string): Promise<TMetaFilterValueRow[]> =>
  prisma.$queryRaw<TMetaFilterValueRow[]>`
    SELECT "key", "nestedKey", "value" FROM (
      SELECT DISTINCT m.key AS "key", NULL::text AS "nestedKey",
        CASE
          WHEN m.key = 'url' AND jsonb_typeof(m.value) = 'string'
            THEN to_jsonb(substring(m.value #>> '{}' from '^[^?#]*[?#]?'))::text
          WHEN jsonb_typeof(m.value) IN ('string', 'number', 'boolean') THEN m.value::text
          ELSE 'null'
        END AS "value"
      FROM "Response" r
      CROSS JOIN LATERAL jsonb_each(${jsonbObjectOrEmpty(META)}) AS m
      WHERE r."surveyId" = ${surveyId}
        AND (m.key = 'url' OR jsonb_typeof(m.value) IN ('string', 'number', 'boolean'))
      UNION ALL
      SELECT DISTINCT m.key, n.key, n.value::text
      FROM "Response" r
      CROSS JOIN LATERAL jsonb_each(${jsonbObjectOrEmpty(META)}) AS m
      CROSS JOIN LATERAL (
        SELECT e.key, e.value
        FROM jsonb_each(${jsonbObjectOrEmpty(META_VALUE)}) AS e
        UNION ALL
        SELECT (a.ord - 1)::text, a.value
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.value) = 'array' THEN m.value ELSE '[]'::jsonb END)
          WITH ORDINALITY AS a(value, ord)
      ) AS n
      WHERE r."surveyId" = ${surveyId}
        AND m.key <> 'url'
        AND jsonb_typeof(m.value) IN ('object', 'array')
        AND jsonb_typeof(n.value) IN ('string', 'number', 'boolean')
    ) AS v
    ORDER BY 1, 2 NULLS FIRST, 3
  `;

/** Distinct scalar `data` values under the given keys — the survey's ingested storage keys. */
const queryDataValues = (surveyId: string, keys: string[]): Promise<TFilterValueRow[]> =>
  prisma.$queryRaw<TFilterValueRow[]>`
    SELECT DISTINCT k.key AS "key", (r.data -> k.key)::text AS "value"
    FROM "Response" r
    CROSS JOIN unnest(${keys}::text[]) AS k(key)
    WHERE r."surveyId" = ${surveyId}
      AND jsonb_typeof(r.data -> k.key) IN ('string', 'number', 'boolean')
    ORDER BY 1, 2
  `;

/**
 * Distinct non-empty string `variables` values under the given keys, at most `limit` per key. The
 * cap can run DB-side here because nothing projects these values: the first `limit` distinct
 * non-empty strings are exactly what `getResponseVariableFilterValues` keeps.
 */
const queryVariableValues = (surveyId: string, keys: string[], limit: number): Promise<TFilterValueRow[]> =>
  prisma.$queryRaw<TFilterValueRow[]>`
    SELECT ranked."key", ranked."value"
    FROM (
      SELECT d."key", d."value", row_number() OVER (PARTITION BY d."key" ORDER BY d."value") AS rank
      FROM (
        SELECT DISTINCT k.key AS "key", (r.variables -> k.key)::text AS "value"
        FROM "Response" r
        CROSS JOIN unnest(${keys}::text[]) AS k(key)
        WHERE r."surveyId" = ${surveyId}
          AND jsonb_typeof(r.variables -> k.key) = 'string'
          AND r.variables ->> k.key <> ''
      ) AS d
    ) AS ranked
    WHERE ranked.rank <= ${limit}::int
    ORDER BY 1, 2
  `;

const emptySlice = (): TFilterValueSlice => ({ contactAttributes: null, data: {}, meta: {} });

/** One slice per row, holding only that key/value under `field`. */
const scalarRowsToSlices = (
  rows: TFilterValueRow[],
  field: "contactAttributes" | "data"
): TFilterValueSlice[] =>
  rows.map(({ key, value }) => ({ ...emptySlice(), [field]: { [key]: JSON.parse(value) } }));

export const metaRowsToSlices = (rows: TMetaFilterValueRow[]): TFilterValueSlice[] =>
  rows.map(({ key, nestedKey, value }) => {
    const parsed: unknown = JSON.parse(value);
    return { ...emptySlice(), meta: { [key]: nestedKey === null ? parsed : { [nestedKey]: parsed } } };
  });

const variableRowsToSlices = (rows: TFilterValueRow[]): Pick<TResponse, "variables">[] =>
  rows.map(({ key, value }) => ({ variables: { [key]: JSON.parse(value) } }));

/**
 * A response that holds only one meta path, for `projectReservedValues`. The other fields are inert
 * on purpose: every string-typed reserved filter entry reads `meta`, and an empty `id` or `null`
 * `language` projects to nothing the filter keeps.
 */
export const toReservedProjectionSlice = (
  surveyId: string,
  slice: Pick<TResponse, "meta">
): TEmbeddedValueResponse => ({
  id: "",
  surveyId,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  finished: false,
  language: null,
  data: {},
  variables: {},
  ttc: {},
  meta: slice.meta,
});

export interface TResponseFilteringValues {
  contactAttributes: TSurveyContactAttributes;
  meta: TSurveyMetaFieldFilter;
  hiddenFields: TResponseHiddenFieldsFilter;
  reservedValues: TSurveyMetaFieldFilter;
  variableValues: TSurveyMetaFieldFilter;
}

/** The distinct-value rows each query returns, in the order the query sorts them. */
export interface TFilterValueRows {
  contactAttributes: TFilterValueRow[];
  meta: TMetaFilterValueRow[];
  data: TFilterValueRow[];
  variables: TFilterValueRow[];
}

/** Turns the query rows into the filter's option lists. Pure, so it is unit-tested without a database. */
export const buildFilteringValues = (survey: TSurvey, rows: TFilterValueRows): TResponseFilteringValues => {
  const metaSlices = metaRowsToSlices(rows.meta);

  return {
    contactAttributes: getResponseContactAttributes(
      scalarRowsToSlices(rows.contactAttributes, "contactAttributes")
    ),
    meta: getResponseMeta(metaSlices),
    hiddenFields: getResponseHiddenFields(survey, scalarRowsToSlices(rows.data, "data")),
    reservedValues: getResponseReservedFilterValues(
      survey,
      metaSlices.map((slice) => toReservedProjectionSlice(survey.id, slice))
    ),
    variableValues: getResponseVariableFilterValues(survey, variableRowsToSlices(rows.variables)),
  };
};

/** The caller authorizes and loads `survey`; every query here is scoped to its id. */
export const getSurveyFilteringValues = async (survey: TSurvey): Promise<TResponseFilteringValues> => {
  const hiddenFieldKeys = getIngestedStorageKeys(survey);
  const variableKeys = getComputedEmbeddedFields(survey)
    .filter(({ field }) => field.dataType === "string")
    .map(({ link }) => link.storageKey);

  const [contactAttributes, meta, data, variables] = await Promise.all([
    queryContactAttributeValues(survey.id),
    queryMetaValues(survey.id),
    hiddenFieldKeys.length > 0 ? queryDataValues(survey.id, hiddenFieldKeys) : [],
    variableKeys.length > 0 ? queryVariableValues(survey.id, variableKeys, MAX_FILTER_VALUE_OPTIONS) : [],
  ]);

  return buildFilteringValues(survey, { contactAttributes, meta, data, variables });
};

/** A not-shown record entry: a block or element id, or an option, row or column id of an element. */
export interface TNotShownFilterRow {
  list: "blocks" | "elements" | "options" | "rows" | "columns";
  elementId: string | null;
  id: string;
}

/** `expression` when it is a jsonb array, else `[]`. */
const jsonbArrayOrEmpty = (expression: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`CASE WHEN jsonb_typeof(${expression}) = 'array' THEN ${expression} ELSE '[]'::jsonb END`;

const NOT_SHOWN_BLOCKS = Prisma.raw(`(r.not_shown -> 'blocks')`);
const NOT_SHOWN_ELEMENTS = Prisma.raw(`(r.not_shown -> 'elements')`);
const NOT_SHOWN_MAP = Prisma.raw(`(r.not_shown -> l.list)`);
const NOT_SHOWN_MAP_VALUE = Prisma.raw("m.value");

type TNotShownQueryIds = {
  blocks: string[];
  elements: string[];
  /** Every option, row and column of the survey, as the record keys them. */
  items: { list: "options" | "rows" | "columns"; elementId: string; id: string }[];
};

/**
 * The distinct ids the survey's not-shown records list (ENG-6951), only those the survey still holds,
 * so the result is bounded by the survey's size whatever a record carries. Responses with no record
 * contribute nothing.
 */
const queryNotShownRows = (surveyId: string, ids: TNotShownQueryIds): Promise<TNotShownFilterRow[]> =>
  prisma.$queryRaw<TNotShownFilterRow[]>`
    SELECT DISTINCT 'blocks' AS "list", NULL::text AS "elementId", b.id AS "id"
    FROM "Response" r
    CROSS JOIN LATERAL jsonb_array_elements_text(${jsonbArrayOrEmpty(NOT_SHOWN_BLOCKS)}) AS b(id)
    WHERE r."surveyId" = ${surveyId} AND b.id = ANY(${ids.blocks}::text[])
    UNION
    SELECT DISTINCT 'elements', NULL::text, e.id
    FROM "Response" r
    CROSS JOIN LATERAL jsonb_array_elements_text(${jsonbArrayOrEmpty(NOT_SHOWN_ELEMENTS)}) AS e(id)
    WHERE r."surveyId" = ${surveyId} AND e.id = ANY(${ids.elements}::text[])
    UNION
    SELECT DISTINCT l.list, m.key, i.id
    FROM "Response" r
    CROSS JOIN (VALUES ('options'), ('rows'), ('columns')) AS l(list)
    CROSS JOIN LATERAL jsonb_each(${jsonbObjectOrEmpty(NOT_SHOWN_MAP)}) AS m
    CROSS JOIN LATERAL jsonb_array_elements_text(${jsonbArrayOrEmpty(NOT_SHOWN_MAP_VALUE)}) AS i(id)
    WHERE r."surveyId" = ${surveyId}
      AND (l.list, m.key, i.id) IN (
        SELECT * FROM unnest(
          ${ids.items.map((item) => item.list)}::text[],
          ${ids.items.map((item) => item.elementId)}::text[],
          ${ids.items.map((item) => item.id)}::text[]
        )
      )
    ORDER BY 1, 2 NULLS FIRST, 3
  `;

const RECORD_LIST_OF: Record<TOptionListKey, "options" | "rows" | "columns"> = {
  choices: "options",
  rows: "rows",
  columns: "columns",
};

/** The query rows as one record: everything any response of the survey was not shown. */
export const notShownRowsToRecord = (rows: TNotShownFilterRow[]): TResponseNotShown => {
  const record: TResponseNotShown = {};
  for (const { list, elementId, id } of rows) {
    if (list === "blocks" || list === "elements") {
      record[list] = [...(record[list] ?? []), id];
    } else if (elementId !== null) {
      const map = (record[list] ??= {});
      map[elementId] = [...(map[elementId] ?? []), id];
    }
  }
  return record;
};

/**
 * What the survey's responses were recorded as not shown (ENG-6951). The shown / not shown filter
 * offers these next to what the survey can hide today, so a show-if removed after responses came in
 * stays filterable. The caller authorizes and loads `survey`; the query is scoped to its id.
 */
export const getRecordedNotShown = async (survey: TSurvey): Promise<TResponseNotShown> => {
  const elements = survey.blocks.flatMap((block) => block.elements);
  const items = elements.flatMap((element) =>
    getOptionLists(element).flatMap(({ listKey, items: listItems }) =>
      listItems.map((item) => ({ list: RECORD_LIST_OF[listKey], elementId: element.id, id: item.id }))
    )
  );
  const rows = await queryNotShownRows(survey.id, {
    blocks: survey.blocks.map((block) => block.id),
    elements: elements.map((element) => element.id),
    items,
  });
  return notShownRowsToRecord(rows);
};
