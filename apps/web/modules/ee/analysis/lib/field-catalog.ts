import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { ANSWER_MEMBER, MAX_ANSWER_RULES, type TAnswerQuestion } from "./answer-filter";
import {
  FEEDBACK_FIELDS,
  FILTER_OPERATORS,
  type FilterOperator,
  SELECTABLE_VALUE_DIMENSION_IDS,
  TIME_GRANULARITIES,
  type TimeGranularity,
} from "./schema-definition";

/**
 * The field catalog (ADR 0001): the fields a chart query may use, published to API and MCP callers and
 * checked by the chart query validator. Both read this module, so what an agent is told it may use and
 * what the API accepts cannot drift apart.
 *
 * It is derived from `FEEDBACK_FIELDS`, the list the chart builder and the AI generator already offer,
 * rather than from the Cube schema. That is what keeps hidden members out: the tenant id, the internal
 * record id and the `*Normalized` companions exist in Cube but are not in the list, so they are neither
 * listed nor accepted.
 *
 * Field names keep their data-source prefix (`FeedbackRecords.npsScore`): the prefix names the source,
 * and charts over other sources are expected.
 *
 * Two kinds of field are not in `FEEDBACK_FIELDS`. `FeedbackRecords.answer` is the answer filter
 * (ENG-6894): a virtual, filter-only member Cube's queryRewrite expands. And each Feedback Dataset adds its
 * embedded-data keys (ENG-6893) as `FeedbackRecords.ed_*` dimensions, so the catalog for a dataset is
 * `getChartFieldCatalog(dataset)`; the static `CHART_FIELD_CATALOG` is the part every dataset shares.
 */

export type TChartFieldKind = "measure" | "dimension" | "timeDimension";
export type TChartFieldType = "number" | "string" | "time" | "boolean";

export type TChartField = {
  name: string;
  kind: TChartFieldKind;
  type: TChartFieldType;
  label: string;
  description: string | null;
  /** The filter operators a chart query may apply to this field. */
  filterOperators: readonly FilterOperator[];
  /** Granularities a time dimension may be grouped by; empty for every other kind. */
  granularities: readonly TimeGranularity[];
  /** Whether `GET /api/v3/charts/fields/{field}/values` can list this field's stored values. */
  valueLookup: boolean;
  /**
   * An embedded-data field's key, exactly as collected (ENG-6893). Callers read the key here rather than
   * from `label`, which is display text and free to change. Absent on every other field.
   */
  key?: string;
};

/** `all-time` is not a preset the app resolves; it means "no date range" and removes one. */
export const ALL_TIME_DATE_RANGE = "all-time";

/** The date ranges callers may name: the app's presets, plus `all-time`. */
export const CHART_DATE_PRESETS: readonly string[] = [...DATE_RANGE_PRESETS, ALL_TIME_DATE_RANGE];

const VALUE_LOOKUP_FIELDS = new Set<string>(SELECTABLE_VALUE_DIMENSION_IDS);

const buildCatalog = (): TChartField[] => [
  ...FEEDBACK_FIELDS.measures.map(
    (measure): TChartField => ({
      name: measure.id,
      kind: "measure",
      // Cube reports every measure as a number; `count` is only the builder's grouping of it.
      type: "number",
      label: measure.label,
      description: measure.description ?? null,
      filterOperators: FILTER_OPERATORS.number,
      granularities: [],
      valueLookup: false,
    })
  ),
  ...FEEDBACK_FIELDS.dimensions.map(
    (dimension): TChartField => ({
      name: dimension.id,
      kind: dimension.type === "time" ? "timeDimension" : "dimension",
      type: dimension.type,
      label: dimension.label,
      description: dimension.description ?? null,
      filterOperators: FILTER_OPERATORS[dimension.type],
      granularities: dimension.type === "time" ? TIME_GRANULARITIES : [],
      valueLookup: VALUE_LOOKUP_FIELDS.has(dimension.id),
    })
  ),
];

/** The answer filter: the operators it takes and how its values are written. Filter-only. */
const ANSWER_FIELD: TChartField = {
  name: ANSWER_MEMBER,
  kind: "dimension",
  type: "string",
  label: "Answer to question",
  description: `Filter only: keeps the records whose submission answered another question of the dataset a certain way, e.g. NPS where Delivery is Late. Each value is "<questionId>:<valueKey>" — the option id of a single- or multi-select, or the number of an NPS, rating, CSAT or CES answer — and one condition names one question. equals is "is" / "is any of" (and "contains" for a multi-select); notEquals is "is not", not offered for a multi-select. A submission that skipped the question never matches. At most ${MAX_ANSWER_RULES} per query.`,
  filterOperators: ["equals", "notEquals"],
  granularities: [],
  valueLookup: false,
};

/** Fields that may only be filtered on: they have no column to group, select or sort by. */
export const FILTER_ONLY_FIELDS: ReadonlySet<string> = new Set([ANSWER_MEMBER]);

export const CHART_FIELD_CATALOG: readonly TChartField[] = [...buildCatalog(), ANSWER_FIELD];

const CATALOG_BY_NAME = new Map(CHART_FIELD_CATALOG.map((field) => [field.name, field]));

/** A field every dataset has. A dataset's embedded-data fields need `createChartFieldLookup`. */
export const getChartField = (name: string): TChartField | undefined => CATALOG_BY_NAME.get(name);

/** An embedded-data key of a dataset and the member it compiles to (`getEmbeddedMemberName`). */
export type TEmbeddedChartField = { name: string; key: string };

/**
 * What one Feedback Dataset adds to the catalog. `answerQuestions` is left out where they were not
 * loaded; answer rules are then checked for shape only.
 */
export type TDatasetChartFields = {
  embeddedFields: readonly TEmbeddedChartField[];
  answerQuestions?: readonly TAnswerQuestion[];
};

/** The catalog field an embedded-data key of a dataset is: a text dimension listed under the key. */
export const toEmbeddedChartField = ({ name, key }: TEmbeddedChartField): TChartField => ({
  name,
  kind: "dimension",
  type: "string",
  // Listed under the key's own name, as collected (ENG-6893).
  label: key,
  description: `Embedded data "${key}". Matched exactly as collected, case included.`,
  filterOperators: FILTER_OPERATORS.string,
  granularities: [],
  valueLookup: true,
  key,
});

/** The catalog for one Feedback Dataset: the shared fields, then its embedded-data keys. */
export const getChartFieldCatalog = (dataset?: TDatasetChartFields): TChartField[] => [
  ...CHART_FIELD_CATALOG,
  ...(dataset?.embeddedFields ?? []).map(toEmbeddedChartField),
];

/** Looks a field up in one dataset's catalog; without a dataset, only the shared fields exist. */
export const createChartFieldLookup = (
  dataset?: TDatasetChartFields
): ((name: string) => TChartField | undefined) => {
  if (!dataset || dataset.embeddedFields.length === 0) return getChartField;
  const embedded = new Map(dataset.embeddedFields.map((field) => [field.name, toEmbeddedChartField(field)]));
  return (name) => CATALOG_BY_NAME.get(name) ?? embedded.get(name);
};
