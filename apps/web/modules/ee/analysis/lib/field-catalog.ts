import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { isEmbeddedFieldMember } from "./embedded-data-fields";
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

export const CHART_FIELD_CATALOG: readonly TChartField[] = buildCatalog();

const CATALOG_BY_NAME = new Map(CHART_FIELD_CATALOG.map((field) => [field.name, field]));

/**
 * An Embedded Data field (ENG-2848). Which ones exist depends on the dataset, so the catalog cannot list
 * them; any well-formed member is accepted here, and the query run refuses one the dataset does not
 * declare. Its operators are every operator a field of its possible types takes — Cube rejects a
 * comparison its compiled type does not support.
 */
const toEmbeddedDataChartField = (name: string): TChartField => ({
  name,
  kind: "dimension",
  type: "string",
  label: name,
  description: null,
  filterOperators: [
    ...new Set([...FILTER_OPERATORS.string, ...FILTER_OPERATORS.number, ...FILTER_OPERATORS.boolean]),
  ],
  granularities: [],
  valueLookup: true,
});

export const getChartField = (name: string): TChartField | undefined =>
  CATALOG_BY_NAME.get(name) ?? (isEmbeddedFieldMember(name) ? toEmbeddedDataChartField(name) : undefined);
