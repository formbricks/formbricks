import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import {
  FEEDBACK_FIELDS,
  FILTER_OPERATORS,
  TIME_GRANULARITIES,
} from "@/modules/ee/analysis/lib/schema-definition";
import {
  V3_FEEDBACK_QUERY_DEFAULT_LIMIT,
  V3_FEEDBACK_QUERY_MAX_DIMENSIONS,
  V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH,
  V3_FEEDBACK_QUERY_MAX_FILTER_NODES,
  V3_FEEDBACK_QUERY_MAX_FILTER_VALUES,
  V3_FEEDBACK_QUERY_MAX_LIMIT,
  V3_FEEDBACK_QUERY_MAX_MEASURES,
  V3_FEEDBACK_QUERY_MAX_ORDER,
} from "./schemas";

export type TV3FeedbackFieldCatalog = ReturnType<typeof serializeV3FeedbackFieldCatalog>;

/**
 * The fields a feedback query may name, as the API's resource: what the catalog in `schema-definition`
 * holds, minus everything that only the chart builder reads (axis ranges, display groups, translation keys).
 * Built on every call from the same arrays the query schema validates against, so what this advertises and
 * what the query accepts cannot drift.
 */
export function serializeV3FeedbackFieldCatalog() {
  return {
    measures: FEEDBACK_FIELDS.measures.map((measure) => ({
      id: measure.id,
      label: measure.label,
      type: measure.type,
      group: measure.group,
      ...(measure.description ? { description: measure.description } : {}),
    })),
    dimensions: FEEDBACK_FIELDS.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      type: dimension.type,
      ...(dimension.description ? { description: dimension.description } : {}),
    })),
    filterOperators: Object.fromEntries(
      Object.entries(FILTER_OPERATORS).map(([type, operators]) => [type, [...operators]])
    ),
    granularities: [...TIME_GRANULARITIES],
    dateRangePresets: [...DATE_RANGE_PRESETS],
    limits: {
      maxMeasures: V3_FEEDBACK_QUERY_MAX_MEASURES,
      maxDimensions: V3_FEEDBACK_QUERY_MAX_DIMENSIONS,
      maxTimeDimensions: 1,
      maxOrderEntries: V3_FEEDBACK_QUERY_MAX_ORDER,
      maxFilterNodes: V3_FEEDBACK_QUERY_MAX_FILTER_NODES,
      maxFilterDepth: V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH,
      maxFilterValues: V3_FEEDBACK_QUERY_MAX_FILTER_VALUES,
      defaultLimit: V3_FEEDBACK_QUERY_DEFAULT_LIMIT,
      maxLimit: V3_FEEDBACK_QUERY_MAX_LIMIT,
    },
  };
}
