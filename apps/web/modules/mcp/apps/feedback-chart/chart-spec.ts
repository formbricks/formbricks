import { z } from "zod";
import type { TV3FeedbackQuery } from "@/app/api/v3/feedback-queries/lib/schemas";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import {
  FEEDBACK_FIELDS,
  GRANULARITY_LABELS,
  type TimeGranularity,
  getMeasureAxisDomain,
} from "@/modules/ee/analysis/lib/schema-definition";

/**
 * What `show_feedback_chart` draws, decided from the query and an optional hint from the caller.
 *
 * Pure on purpose: the chart is a function of the query's own members, so the same query always gets
 * the same chart and every refusal can name the member that caused it. The hint never reaches the
 * query: it is validated here, before Cube is asked anything.
 */

export const FEEDBACK_CHART_TYPES = ["bar", "line", "area", "pie", "number", "table"] as const;
export type TFeedbackChartType = (typeof FEEDBACK_CHART_TYPES)[number];

/** The most measures one chart plots side by side when the caller does not pick one. */
export const FEEDBACK_CHART_MAX_DEFAULT_MEASURES = 6;

export const ZMcpFeedbackChartHint = z
  .strictObject({
    type: z
      .enum(FEEDBACK_CHART_TYPES)
      .optional()
      .describe(
        "How to draw it. Omit to let the server choose: a time axis gives a line, one dimension a bar, no dimension a number, anything else a table. pie needs one dimension and a count measure."
      ),
    x: z
      .string()
      .max(120)
      .optional()
      .describe(
        "Field on the x axis (categories, or the time axis): one of the query's dimensions or its time dimension. Defaults to the time axis, else the first dimension."
      ),
    y: z
      .string()
      .max(120)
      .optional()
      .describe(
        "The measure to plot: one of the query's measures. Defaults to the first measure, plus the other measures of the same kind when they are all counts."
      ),
    series: z
      .string()
      .max(120)
      .optional()
      .describe("A second dimension that splits the chart into one series per value, for example sentiment."),
    title: z.string().trim().min(1).max(120).optional().describe("Heading above the chart."),
  })
  .describe("Optional drawing hint. Every field is checked against the query's own members.");

export type TMcpFeedbackChartHint = z.infer<typeof ZMcpFeedbackChartHint>;

export type TFeedbackChartColumn = {
  id: string;
  label: string;
  kind: "time" | "dimension" | "measure";
  /** The fixed range of a bounded score (NPS is -100 to 100), so the axis does not zoom into the data. */
  domain?: [number, number];
};

export type TFeedbackChartSpec = {
  type: TFeedbackChartType;
  title: string;
  /** Column id of the x axis or the pie's slices. */
  x?: string;
  xKind?: "time" | "category";
  granularity?: TimeGranularity;
  /** Column ids of the measures drawn. */
  y: string[];
  /** Column id of the dimension that splits the chart into series. */
  series?: string;
  /** Measures the query returns that this chart does not draw; they stay in the table. */
  omittedMeasures?: string[];
};

export type TResolvedFeedbackChart =
  | { ok: true; spec: TFeedbackChartSpec; columns: TFeedbackChartColumn[] }
  | { ok: false; detail: string; invalidParams: InvalidParam[] };

const fieldLabel = (id: string): string =>
  FEEDBACK_FIELDS.dimensions.find((field) => field.id === id)?.label ??
  FEEDBACK_FIELDS.measures.find((field) => field.id === id)?.label ??
  id;

const measureDefinition = (id: string) => FEEDBACK_FIELDS.measures.find((measure) => measure.id === id);

type TQueryMembers = {
  measures: string[];
  dimensions: string[];
  /** The bucketed time column (`<dimension>.<granularity>`), present only when the query buckets by time. */
  timeKey?: string;
  timeDimension?: string;
  granularity?: TimeGranularity;
};

const readMembers = (query: TV3FeedbackQuery): TQueryMembers => {
  const timeDimension = query.timeDimensions?.[0];
  const granularity = timeDimension?.granularity;
  return {
    measures: query.measures ?? [],
    dimensions: query.dimensions ?? [],
    // A time dimension without a granularity only filters (a date range): Cube returns no column for it.
    ...(timeDimension && granularity
      ? {
          timeKey: `${timeDimension.dimension}.${granularity}`,
          timeDimension: timeDimension.dimension,
          granularity,
        }
      : {}),
  };
};

/** The columns a row of this query carries, in reading order: time, dimensions, measures. */
export const getFeedbackChartColumns = (query: TV3FeedbackQuery): TFeedbackChartColumn[] => {
  const members = readMembers(query);
  const columns: TFeedbackChartColumn[] = [];
  if (members.timeKey && members.timeDimension && members.granularity) {
    columns.push({
      id: members.timeKey,
      label: `${fieldLabel(members.timeDimension)} (${(GRANULARITY_LABELS[members.granularity] ?? members.granularity).toLowerCase()})`,
      kind: "time",
    });
  }
  for (const id of members.dimensions) {
    columns.push({ id, label: fieldLabel(id), kind: "dimension" });
  }
  for (const id of members.measures) {
    const domain = getMeasureAxisDomain(id);
    columns.push({
      id,
      label: fieldLabel(id),
      kind: "measure",
      ...(domain ? { domain: [domain[0], domain[1]] as [number, number] } : {}),
    });
  }
  return columns;
};

const refuse = (name: string, reason: string): TResolvedFeedbackChart => ({
  ok: false,
  detail: `Cannot draw this chart: ${reason}`,
  invalidParams: [{ name, reason }],
});

const listIds = (ids: string[]): string => (ids.length > 0 ? ids.join(", ") : "none");

const defaultMeasures = (measures: string[]): string[] => {
  const [first] = measures;
  if (!first) return [];
  // Counts share one scale and can sit side by side; scores and averages each have their own, and two
  // scales on one axis would invent a relationship, so those are drawn one measure at a time.
  if (measureDefinition(first)?.group !== "count") return [first];
  return measures
    .filter((id) => measureDefinition(id)?.group === "count")
    .slice(0, FEEDBACK_CHART_MAX_DEFAULT_MEASURES);
};

const defaultType = (members: TQueryMembers): TFeedbackChartType => {
  if (members.measures.length === 0) return "table";
  const keys = (members.timeKey ? 1 : 0) + members.dimensions.length;
  if (keys === 0) return "number";
  if (members.timeKey && keys <= 2) return "line";
  if (!members.timeKey && keys === 1) return "bar";
  return "table";
};

const defaultTitle = (members: TQueryMembers, y: string[], x?: string, series?: string): string => {
  const shown = y.slice(0, 2).map(fieldLabel);
  const measures = y.length > 2 ? [...shown, `${y.length - 2} more`] : shown;
  const head = measures.join(" and ");
  const by = [x, series].filter((id): id is string => Boolean(id));
  if (by.length === 0) return head;
  const phrases = by.map((id) =>
    id === members.timeKey && members.granularity ? `${members.granularity}` : fieldLabel(id).toLowerCase()
  );
  return `${head} by ${phrases.join(" and ")}`;
};

/**
 * Validate the hint against the query and fill in what it left out. A hint that names a field the query
 * does not return, or asks for a chart the data cannot make (a pie of an average, a number with
 * dimensions), is refused with the reason, so the caller can fix the call instead of getting a different
 * chart than it asked for.
 */
export const resolveFeedbackChart = (
  query: TV3FeedbackQuery,
  hint: TMcpFeedbackChartHint | undefined
): TResolvedFeedbackChart => {
  const members = readMembers(query);
  const columns = getFeedbackChartColumns(query);
  const keys = [...(members.timeKey ? [members.timeKey] : []), ...members.dimensions];
  const type = hint?.type ?? defaultType(members);

  // The time dimension's own id names its bucket column: the caller wrote it in the query, so it is the
  // name they will use in the hint.
  const requestedX = hint?.x && hint.x === members.timeDimension ? members.timeKey : hint?.x;

  if (requestedX && !keys.includes(requestedX)) {
    return refuse(
      "chart.x",
      `'${requestedX}' is not a dimension or bucketed time dimension of the query. Available: ${listIds(keys)}.`
    );
  }
  if (hint?.y && !members.measures.includes(hint.y)) {
    return refuse(
      "chart.y",
      `'${hint.y}' is not a measure of the query. Available: ${listIds(members.measures)}.`
    );
  }
  if (hint?.series && !members.dimensions.includes(hint.series)) {
    return refuse(
      "chart.series",
      `'${hint.series}' is not a dimension of the query. Available: ${listIds(members.dimensions)}.`
    );
  }
  if (hint?.series && requestedX === hint.series) {
    return refuse("chart.series", "The series dimension must differ from the x field.");
  }

  const title = hint?.title;

  if (type === "table") {
    if (hint?.x || hint?.y || hint?.series) {
      return refuse("chart.type", "A table shows every column; x, y and series do not apply to it.");
    }
    return {
      ok: true,
      columns,
      spec: { type, title: title ?? defaultTitle(members, members.measures), y: [] },
    };
  }

  if (members.measures.length === 0) {
    return refuse(
      "chart.type",
      `A ${type} chart needs at least one measure in the query; without one, ask for a table.`
    );
  }

  if (type === "number") {
    if (keys.length > 0) {
      return refuse(
        "chart.type",
        "A number shows one value per measure, so the query must have no dimensions and no bucketed time dimension. Use a bar or a table."
      );
    }
    if (hint?.x || hint?.series) {
      return refuse("chart.type", "A number has no axis; x and series do not apply to it.");
    }
    const y = hint?.y ? [hint.y] : members.measures;
    return {
      ok: true,
      columns,
      spec: {
        type,
        title: title ?? defaultTitle(members, y),
        y,
        ...(y.length < members.measures.length
          ? { omittedMeasures: members.measures.filter((id) => !y.includes(id)) }
          : {}),
      },
    };
  }

  // bar, line, area and pie all plot rows by x, and by series when there is a second key.
  if (keys.length === 0) {
    return refuse(
      "chart.type",
      `A ${type} chart needs a dimension or a bucketed time dimension to put on the x axis; the query has neither. Use a number.`
    );
  }
  if (keys.length > 2) {
    return refuse(
      "chart.type",
      `The query groups by ${keys.length} fields (${keys.join(", ")}); a chart can show two at most. Drop one from the query or ask for a table.`
    );
  }

  const x = requestedX ?? members.timeKey ?? keys[0];
  const remaining = keys.filter((id) => id !== x);
  if (remaining.length > 1) {
    return refuse("chart.x", "Cannot tell which field to split the series by; drop a field from the query.");
  }
  const [other] = remaining;
  if (hint?.series && other !== hint.series) {
    return refuse(
      "chart.series",
      `With x '${x}' the query's other grouping field is '${other ?? "none"}', not '${hint.series}'.`
    );
  }
  const series = other;

  if (type === "pie") {
    if (series) {
      return refuse(
        "chart.type",
        `A pie shows one dimension, but the query also groups by '${series}'. Drop it or use a bar.`
      );
    }
    if (x === members.timeKey) {
      return refuse(
        "chart.type",
        "A pie shows parts of a whole, not a trend over time. Use a line or a bar."
      );
    }
    const measure = hint?.y ?? members.measures[0];
    if (measureDefinition(measure)?.type !== "count") {
      return refuse(
        "chart.y",
        `A pie adds slices up to a whole, and '${measure}' is not a count, so its slices do not add up. Use a bar.`
      );
    }
    return {
      ok: true,
      columns,
      spec: {
        type,
        title: title ?? defaultTitle(members, [measure], x),
        x,
        xKind: "category",
        y: [measure],
        ...(members.measures.length > 1
          ? { omittedMeasures: members.measures.filter((id) => id !== measure) }
          : {}),
      },
    };
  }

  const y = hint?.y ? [hint.y] : series ? [members.measures[0]] : defaultMeasures(members.measures);
  const omitted = members.measures.filter((id) => !y.includes(id));
  const isTime = x === members.timeKey;
  return {
    ok: true,
    columns,
    spec: {
      type,
      title: title ?? defaultTitle(members, y, x, series),
      x,
      xKind: isTime ? "time" : "category",
      ...(isTime && members.granularity ? { granularity: members.granularity } : {}),
      y,
      ...(series ? { series } : {}),
      ...(omitted.length > 0 ? { omittedMeasures: omitted } : {}),
    },
  };
};
