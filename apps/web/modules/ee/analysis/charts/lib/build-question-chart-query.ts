/**
 * Builds a ready-to-run chart query for a single survey question.
 *
 * Given a source (survey) name, a question label and its field type, this returns a
 * Cube query pre-filtered to that question plus a sensible default measure and chart
 * type — the "one-click smart default" behind the survey → question picker in the
 * create-chart dialog. The user can still tweak everything in the advanced builder
 * afterwards.
 *
 * The question is targeted by its label text (`fieldLabel`) rather than a stable field
 * ID because the records pipeline does not expose a per-question ID yet (tracked in
 * ENG-1562). `equals` is case-insensitive server-side, so label matching is reliable
 * for exact stored values. Swap `fieldLabel` for the field ID here once it lands.
 */
import type { TChartQuery, TMemberFilter } from "@formbricks/types/analysis";
import { FEEDBACK_MEASURE_IDS } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

const SOURCE_NAME = "FeedbackRecords.sourceName";
const FIELD_LABEL = "FeedbackRecords.fieldLabel";
const VALUE_TEXT = "FeedbackRecords.valueText";
const VALUE_NUMBER = "FeedbackRecords.valueNumber";
const VALUE_BOOLEAN = "FeedbackRecords.valueBoolean";

const COUNT = "FeedbackRecords.count";
const NPS_SCORE = "FeedbackRecords.npsScore";
const CSAT_SCORE = "FeedbackRecords.csatScore";
const CES_AVERAGE = "FeedbackRecords.cesAverage";
const RATING_AVERAGE = "FeedbackRecords.ratingAverage";

/** HubFieldType tokens (packages/database/schema.prisma → enum HubFieldType). */
export type TQuestionFieldType =
  | "text"
  | "categorical"
  | "nps"
  | "csat"
  | "ces"
  | "rating"
  | "number"
  | "boolean"
  | "date";

export interface QuestionChartInput {
  /** Question label as stored in FeedbackRecords.fieldLabel. */
  fieldLabel: string;
  /** HubFieldType of the question; unknown values fall back to a response count. */
  fieldType: string;
  /**
   * Optional source (survey) name. Omitted by default: the chart covers the question
   * across the whole directory. Pass a value to narrow to a single source.
   */
  sourceName?: string;
}

export interface QuestionChartPreset {
  query: TChartQuery;
  chartType: TChartType;
}

/** Measures gated on availability so the mapper auto-upgrades as new measures ship
 * (e.g. rating measures from ENG-1661) without a code change here. */
const hasMeasure = (id: string): boolean => FEEDBACK_MEASURE_IDS.includes(id);

/**
 * Build the question preset query + chart type.
 *
 * Always filters `fieldLabel equals <question>`, plus `sourceName equals <survey>` when a
 * source is given. Measure/dimension/chartType are chosen from the question's field type:
 *  - nps/csat/ces → the matching score/average measure, shown as a single big number
 *  - rating → rating average once available, otherwise a rating distribution (count by value)
 *  - categorical → response count split by the answer label (bar)
 *  - number/boolean → distribution of the answer value
 *  - text/date/unknown → total response count
 */
export function buildQuestionChartQuery({
  fieldLabel,
  fieldType,
  sourceName,
}: QuestionChartInput): QuestionChartPreset {
  const filters: TMemberFilter[] = [
    ...(sourceName ? [{ member: SOURCE_NAME, operator: "equals", values: [sourceName] }] : []),
    { member: FIELD_LABEL, operator: "equals", values: [fieldLabel] },
  ];

  const preset = (
    measures: string[],
    dimensions: string[] | undefined,
    chartType: TChartType
  ): QuestionChartPreset => ({
    query: {
      measures,
      ...(dimensions && dimensions.length > 0 ? { dimensions } : {}),
      filters,
    },
    chartType,
  });

  switch (fieldType.toLowerCase()) {
    case "nps":
      return preset([hasMeasure(NPS_SCORE) ? NPS_SCORE : COUNT], undefined, "big_number");
    case "csat":
      return preset([hasMeasure(CSAT_SCORE) ? CSAT_SCORE : COUNT], undefined, "big_number");
    case "ces":
      return preset([hasMeasure(CES_AVERAGE) ? CES_AVERAGE : COUNT], undefined, "big_number");
    case "rating":
      // Prefer the average once the rating measures ship (ENG-1661); until then fall
      // back to a rating distribution so the chart is still meaningful.
      return hasMeasure(RATING_AVERAGE)
        ? preset([RATING_AVERAGE], undefined, "big_number")
        : preset([COUNT], [VALUE_NUMBER], "bar");
    case "categorical":
      return preset([COUNT], [VALUE_TEXT], "bar");
    case "number":
      return preset([COUNT], [VALUE_NUMBER], "bar");
    case "boolean":
      return preset([COUNT], [VALUE_BOOLEAN], "pie");
    case "text":
    case "date":
    default:
      return preset([COUNT], undefined, "big_number");
  }
}
