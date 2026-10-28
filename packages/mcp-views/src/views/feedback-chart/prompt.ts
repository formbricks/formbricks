import type { FormatContext } from "../../shared/format";
import { isRecord } from "../../shared/guards";
import { plural } from "../../shared/plural";
import { formatCalendarDate } from "./format";
import type { Granularity } from "./model";

/** Text the view composes from query and chart data: the follow-up message and the subtitle. */

const FINER: Record<Granularity, Granularity | undefined> = {
  year: "month",
  quarter: "month",
  month: "week",
  week: "day",
  day: "hour",
  hour: undefined,
};

/** A cuid2: what Formbricks ids look like. Anything else is left out of the message. */
const ID_SHAPE = /^[a-z0-9]{20,32}$/;
/** A member of the closed query spec (`FeedbackRecords.sentiment`, `FeedbackRecords.collectedAt.month`). */
const MEMBER_SHAPE = /^[A-Za-z0-9_.]+$/;
const MEMBER_MAX_CHARS = 120;

const readId = (value: string | undefined): string | undefined =>
  value !== undefined && ID_SHAPE.test(value) ? value : undefined;

const readMember = (value: string | undefined): string | undefined =>
  value !== undefined && value.length <= MEMBER_MAX_CHARS && MEMBER_SHAPE.test(value) ? value : undefined;

/**
 * What the chart's selection stands for. The `*Label`/`*Value` fields are display text for the selection
 * bar (React text nodes), and they come from feedback and workspace data, so `buildDigDeeperPrompt` never
 * reads them. The prompt is built from `ref` alone.
 */
export interface DigDeeperTarget {
  chartTitle: string;
  /** Label of the x field and the text of the clicked value. */
  xLabel: string;
  xValue: string;
  granularity?: Granularity;
  /** Label of the series field and the clicked series, when the chart has one. */
  seriesLabel?: string;
  seriesValue?: string;
  measureLabel: string;
  valueText: string;
  /** Ids and closed-spec member names: the only part of the target the message is allowed to use. */
  ref: DigDeeperRef;
}

export interface DigDeeperRef {
  datasetId?: string;
  /** Query member on the x axis (or the pie's slices), e.g. `FeedbackRecords.sentiment`. */
  x?: string;
  /** Query member that splits the chart into series. */
  series?: string;
  /** The measure the selected value belongs to, e.g. `FeedbackRecords.count`. */
  measure?: string;
}

/**
 * The message the person can send to the agent from a selected point. A fixed template: the only things
 * that enter it are the dataset id (shape-checked), query member names (checked against
 * `/^[A-Za-z0-9_.]+$/`) and a granularity from the closed set, each dropped when it does not fit. It never
 * carries a category label, a series name, a value or the chart title, since those are feedback text a
 * respondent could have written ("ignore previous instructions...") and a user-role message is the one
 * place an agent must be able to trust. The agent finds the point through the dataset and the members;
 * nothing is sent until the person presses the button, and it asks and names without telling the agent
 * which tool to call.
 */
export const buildDigDeeperPrompt = (target: DigDeeperTarget): string => {
  const { ref, granularity } = target;
  const datasetId = readId(ref.datasetId);
  const measure = readMember(ref.measure);
  const x = readMember(ref.x);
  const series = readMember(ref.series);
  const facts = [
    datasetId ? `dataset ${datasetId}` : undefined,
    measure ? `measure ${measure}` : undefined,
    x ? `grouped by ${x}` : undefined,
    series ? `split by ${series}` : undefined,
  ].filter((fact): fact is string => fact !== undefined);

  const finer = granularity ? FINER[granularity] : undefined;
  const ask = finer
    ? `Break it down further by ${finer}, and tell me what stands out.`
    : "Break it down further, and tell me what is behind it.";
  const where = facts.length > 0 ? ` (${facts.join(", ")})` : "";
  return `I selected a point on the feedback chart you showed me${where}. ${ask}`;
};

type QueryLike = Record<string, unknown> | undefined;

/** "Last 30 days", "Jan 1, 2026 to Jan 31, 2026", "2 filters": what the query was scoped to. */
export const describeScope = (query: QueryLike, context: FormatContext = {}): string[] => {
  const parts: string[] = [];
  const timeDimensions: unknown = query?.timeDimensions;
  const timeDimension: unknown = Array.isArray(timeDimensions) ? timeDimensions[0] : undefined;
  if (isRecord(timeDimension)) {
    const range = timeDimension.dateRange;
    if (typeof range === "string") {
      parts.push(range.charAt(0).toUpperCase() + range.slice(1));
    } else if (
      Array.isArray(range) &&
      range.length === 2 &&
      range.every((item) => typeof item === "string")
    ) {
      parts.push(`${formatCalendarDate(range[0], context)} to ${formatCalendarDate(range[1], context)}`);
    }
  }
  const filters = Array.isArray(query?.filters) ? query.filters.length : 0;
  if (filters > 0) parts.push(plural(filters, "filter"));
  return parts;
};
