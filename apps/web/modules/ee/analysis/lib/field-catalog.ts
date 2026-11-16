import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { ANSWER_MEMBER, MAX_ANSWER_RULES, type TAnswerQuestion } from "./answer-filter";
import {
  collectQueryMemberNames,
  isEmbeddedNumberMemberName,
  toEmbeddedNumberMember,
} from "./embedded-data-fields";
import {
  FEEDBACK_FIELDS,
  FILTER_OPERATORS,
  type FilterOperator,
  RESPONSE_TOPIC_FILTER_OPERATORS,
  SELECTABLE_VALUE_DIMENSION_IDS,
  TIME_GRANULARITIES,
  TOPIC_FIELDS,
  type TimeGranularity,
  isResponseTopicDimensionId,
  isTopicDimensionId,
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
 * Three kinds of field are not in `FEEDBACK_FIELDS`. `FeedbackRecords.answer` is the answer filter
 * (ENG-6894): a virtual, filter-only member Cube's queryRewrite expands. Each Feedback Dataset adds its
 * embedded-data keys (ENG-6893) as `FeedbackRecords.ed_*` dimensions. And a dataset with an active
 * taxonomy adds the topic fields (ENG-6989, `TOPIC_FIELDS`). So the catalog for a dataset is
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

/**
 * The topic fields as catalog fields (ENG-6989). Listed only for a dataset with an active taxonomy
 * (`getChartFieldCatalog`), but a query naming one is valid on any dataset: a saved chart keeps running
 * when its dataset's taxonomy goes away, and simply finds no topics.
 */
export const TOPIC_CHART_FIELDS: readonly TChartField[] = TOPIC_FIELDS.map(
  (field): TChartField => ({
    name: field.id,
    kind: "dimension",
    type: "string",
    label: field.label,
    description: field.description ?? null,
    filterOperators: isResponseTopicDimensionId(field.id)
      ? RESPONSE_TOPIC_FILTER_OPERATORS
      : FILTER_OPERATORS.string,
    granularities: [],
    valueLookup: true,
  })
);

const CATALOG_BY_NAME = new Map(
  [...CHART_FIELD_CATALOG, ...TOPIC_CHART_FIELDS].map((field) => [field.name, field])
);

/**
 * A field a query may name on any dataset: the shared fields, and the topic fields. A dataset's
 * embedded-data fields need `createChartFieldLookup`.
 */
export const getChartField = (name: string): TChartField | undefined => CATALOG_BY_NAME.get(name);

/** Whether a chart query names a topic field anywhere: grouping, filter, order. */
export const queryNamesTopicField = (query: unknown): boolean =>
  [...collectQueryMemberNames(query)].some(isTopicDimensionId);

/** An embedded-data key of a dataset and the member it compiles to (`getEmbeddedMemberName`). */
export type TEmbeddedChartField = { name: string; key: string };

/**
 * A Feedback Dataset's current topic labels (ENG-6989): the values its topic fields hold. `topics` are
 * the level-1 labels, `subtopics` the level-2 ones written "Topic › Subtopic", as Cube writes them.
 */
export type TDatasetTopics = {
  topics: readonly string[];
  subtopics: readonly string[];
};

/**
 * Whether a dataset's topic fields can be offered, and with which values (`getDatasetTopics`):
 * - `active`: it has an active directory taxonomy, and the organization may read taxonomies.
 * - `inactive`: it has no active directory taxonomy.
 * - `forbidden`: the organization's plan has no Feedback Directories, so no taxonomy access.
 * - `unavailable`: Hub could not be asked.
 */
export type TDatasetTopicsState =
  | { status: "active"; labels: TDatasetTopics }
  | { status: "inactive" | "forbidden" | "unavailable" };

/** Why a dataset's topic fields cannot be used where they must be current: written, previewed, looked up. */
export const TOPICS_UNAVAILABLE_REASONS: Record<Exclude<TDatasetTopicsState["status"], "active">, string> = {
  inactive: "This dataset has no active taxonomy yet, so it has no topics. Generate its topics first.",
  forbidden:
    "Topic fields need the Feedback Directories feature, which this organization's plan does not include.",
  unavailable: "The dataset's topics could not be loaded. Try again shortly.",
};

/**
 * What one Feedback Dataset adds to the catalog. `answerQuestions` is left out where they were not
 * loaded; answer rules are then checked for shape only. `topics` is left out where they were not asked
 * for (`getDatasetChartFields`'s `withTopics`): reading a saved chart does not, so its topic fields run
 * unchecked, while listing, writing and previewing do.
 */
export type TDatasetChartFields = {
  embeddedFields: readonly TEmbeddedChartField[];
  answerQuestions?: readonly TAnswerQuestion[];
  topics?: TDatasetTopicsState;
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

/**
 * The catalog for one Feedback Dataset: the shared fields, its topic fields when it has an active
 * taxonomy, then its embedded-data keys.
 */
export const getChartFieldCatalog = (dataset?: TDatasetChartFields): TChartField[] => [
  ...CHART_FIELD_CATALOG,
  ...(dataset?.topics?.status === "active" ? TOPIC_CHART_FIELDS : []),
  ...(dataset?.embeddedFields ?? []).map(toEmbeddedChartField),
];

/**
 * The numeric twin of an embedded-data field (`FeedbackRecords.edn_*`): the key's value as a number, compared
 * with `gt` / `gte` / `lt` / `lte` (and equality) by a dashboard filter. Filter-only and never listed: a
 * chart groups by the key's own field.
 */
export const toEmbeddedNumberChartField = ({ name, key }: TEmbeddedChartField): TChartField => ({
  name: toEmbeddedNumberMember(name),
  kind: "dimension",
  type: "number",
  label: key,
  description: `Embedded data "${key}" read as a number; no value where it is not one. Filter only.`,
  filterOperators: FILTER_OPERATORS.number,
  granularities: [],
  valueLookup: false,
  key,
});

/** Whether a field may only be filtered on: the answer filter, and an embedded key's numeric twin. */
export const isFilterOnlyField = (name: string): boolean =>
  FILTER_ONLY_FIELDS.has(name) || isEmbeddedNumberMemberName(name);

/**
 * Looks a field up in one dataset's catalog; without a dataset, only the fields every dataset may name
 * exist (`getChartField`). A dataset's embedded-data key is found by its member and by its numeric twin
 * (`toEmbeddedNumberChartField`).
 */
export const createChartFieldLookup = (
  dataset?: TDatasetChartFields
): ((name: string) => TChartField | undefined) => {
  if (!dataset || dataset.embeddedFields.length === 0) return getChartField;
  const embedded = new Map(
    dataset.embeddedFields.flatMap((field) => {
      const numeric = toEmbeddedNumberChartField(field);
      return [
        [field.name, toEmbeddedChartField(field)],
        [numeric.name, numeric],
      ] as const;
    })
  );
  return (name) => CATALOG_BY_NAME.get(name) ?? embedded.get(name);
};
