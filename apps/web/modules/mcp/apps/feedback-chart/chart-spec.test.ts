import { describe, expect, test } from "vitest";
import type { TV3FeedbackQuery } from "@/app/api/v3/feedback-queries/lib/schemas";
import { type TMcpFeedbackChartHint, getFeedbackChartColumns, resolveFeedbackChart } from "./chart-spec";

const NPS = "FeedbackRecords.npsScore";
const COUNT = "FeedbackRecords.count";
const PROMOTERS = "FeedbackRecords.promoterCount";
const SENTIMENT = "FeedbackRecords.sentiment";
const LABEL = "FeedbackRecords.fieldLabel";
const COLLECTED = "FeedbackRecords.collectedAt";
const MONTH = `${COLLECTED}.month`;

const resolve = (query: TV3FeedbackQuery, hint?: TMcpFeedbackChartHint) => resolveFeedbackChart(query, hint);

const expectOk = (query: TV3FeedbackQuery, hint?: TMcpFeedbackChartHint) => {
  const result = resolve(query, hint);
  if (!result.ok) throw new Error(`expected a chart, got: ${result.detail}`);
  return result;
};

const expectRefused = (query: TV3FeedbackQuery, hint: TMcpFeedbackChartHint) => {
  const result = resolve(query, hint);
  if (result.ok) throw new Error("expected a refusal");
  return result;
};

describe("default chart from the result shape", () => {
  test("a bucketed time dimension draws a line over the bucket column", () => {
    const { spec } = expectOk({
      measures: [NPS],
      timeDimensions: [{ dimension: COLLECTED, granularity: "month" }],
    });
    expect(spec).toMatchObject({ type: "line", x: MONTH, xKind: "time", granularity: "month", y: [NPS] });
    expect(spec.series).toBeUndefined();
  });

  test("a time axis plus one dimension is a line with a series per dimension value", () => {
    const { spec } = expectOk({
      measures: [COUNT],
      dimensions: [SENTIMENT],
      timeDimensions: [{ dimension: COLLECTED, granularity: "week" }],
    });
    expect(spec).toMatchObject({ type: "line", x: `${COLLECTED}.week`, series: SENTIMENT });
  });

  test("one dimension draws a bar", () => {
    const { spec } = expectOk({ measures: [NPS], dimensions: [LABEL] });
    expect(spec).toMatchObject({ type: "bar", x: LABEL, xKind: "category", y: [NPS] });
  });

  test("no dimension draws a number", () => {
    expect(expectOk({ measures: [NPS] }).spec).toMatchObject({ type: "number", y: [NPS] });
  });

  test("a date range without a granularity is a filter, not an axis", () => {
    const { spec, columns } = expectOk({
      measures: [COUNT],
      timeDimensions: [{ dimension: COLLECTED, dateRange: "last 30 days" }],
    });
    expect(spec.type).toBe("number");
    expect(columns.map((column) => column.id)).toEqual([COUNT]);
  });

  test("two dimensions, three keys, or no measure fall back to a table", () => {
    expect(expectOk({ measures: [COUNT], dimensions: [SENTIMENT, LABEL] }).spec.type).toBe("table");
    expect(
      expectOk({
        measures: [COUNT],
        dimensions: [SENTIMENT, LABEL],
        timeDimensions: [{ dimension: COLLECTED, granularity: "day" }],
      }).spec.type
    ).toBe("table");
    expect(expectOk({ dimensions: [SENTIMENT] }).spec.type).toBe("table");
  });
});

describe("columns", () => {
  test("lists time, dimensions, then measures, with labels and the NPS axis domain", () => {
    const columns = getFeedbackChartColumns({
      measures: [NPS, COUNT],
      dimensions: [SENTIMENT],
      timeDimensions: [{ dimension: COLLECTED, granularity: "day" }],
    });
    expect(columns.map((column) => [column.id, column.kind])).toEqual([
      [`${COLLECTED}.day`, "time"],
      [SENTIMENT, "dimension"],
      [NPS, "measure"],
      [COUNT, "measure"],
    ]);
    expect(columns[0].label).toBe("Collected At (day)");
    expect(columns[2].domain).toEqual([-100, 100]);
    expect(columns[3].domain).toBeUndefined();
  });
});

describe("measures", () => {
  test("count measures are drawn together; a score is drawn alone with the rest left to the table", () => {
    expect(expectOk({ measures: [COUNT, PROMOTERS], dimensions: [LABEL] }).spec.y).toEqual([
      COUNT,
      PROMOTERS,
    ]);

    const { spec } = expectOk({ measures: [NPS, COUNT], dimensions: [LABEL] });
    expect(spec.y).toEqual([NPS]);
    expect(spec.omittedMeasures).toEqual([COUNT]);
  });

  test("with a series the chart draws one measure", () => {
    const { spec } = expectOk({
      measures: [COUNT, PROMOTERS],
      dimensions: [SENTIMENT],
      timeDimensions: [{ dimension: COLLECTED, granularity: "day" }],
    });
    expect(spec.y).toEqual([COUNT]);
    expect(spec.omittedMeasures).toEqual([PROMOTERS]);
  });

  test("a hint picks the measure", () => {
    expect(expectOk({ measures: [COUNT, PROMOTERS], dimensions: [LABEL] }, { y: PROMOTERS }).spec.y).toEqual([
      PROMOTERS,
    ]);
  });
});

describe("hint validation against the query", () => {
  const query: TV3FeedbackQuery = {
    measures: [COUNT],
    dimensions: [SENTIMENT],
    timeDimensions: [{ dimension: COLLECTED, granularity: "month" }],
  };

  test("refuses an x, y or series the query does not return, naming the options", () => {
    expect(expectRefused(query, { x: LABEL }).invalidParams[0]).toMatchObject({ name: "chart.x" });
    expect(expectRefused(query, { y: NPS }).invalidParams[0]).toMatchObject({ name: "chart.y" });
    expect(expectRefused(query, { series: LABEL }).invalidParams[0]).toMatchObject({ name: "chart.series" });
    expect(expectRefused(query, { x: LABEL }).detail).toContain(MONTH);
  });

  test("accepts the time dimension's own id as the name of its bucket column", () => {
    expect(expectOk(query, { x: COLLECTED }).spec.x).toBe(MONTH);
  });

  test("refuses a time dimension that is only a filter as x", () => {
    expect(
      expectRefused(
        { measures: [COUNT], dimensions: [SENTIMENT], timeDimensions: [{ dimension: COLLECTED }] },
        { x: COLLECTED }
      ).invalidParams[0]
    ).toMatchObject({ name: "chart.x" });
  });

  test("lets the hint swap which dimension is x and which is the series", () => {
    const { spec } = expectOk(
      { measures: [COUNT], dimensions: [SENTIMENT, LABEL] },
      { type: "bar", x: LABEL }
    );
    expect(spec).toMatchObject({ type: "bar", x: LABEL, series: SENTIMENT });
  });

  test("refuses a series that is not the query's other grouping field, or equals x", () => {
    const two: TV3FeedbackQuery = { measures: [COUNT], dimensions: [SENTIMENT, LABEL] };
    expect(
      expectRefused(two, { type: "bar", x: SENTIMENT, series: SENTIMENT }).invalidParams[0]
    ).toMatchObject({
      name: "chart.series",
    });
    expect(
      expectRefused(
        { measures: [COUNT], dimensions: [SENTIMENT, LABEL, "FeedbackRecords.language"] },
        { type: "bar" }
      ).detail
    ).toContain("two at most");
  });
});

describe("chart types the data cannot make", () => {
  test("a number needs a query without dimensions", () => {
    expect(expectRefused({ measures: [NPS], dimensions: [LABEL] }, { type: "number" }).detail).toContain(
      "no dimensions"
    );
  });

  test("a number with several measures shows one value each", () => {
    expect(expectOk({ measures: [NPS, COUNT] }).spec).toMatchObject({ type: "number", y: [NPS, COUNT] });
    expect(expectOk({ measures: [NPS, COUNT] }, { y: COUNT }).spec).toMatchObject({
      y: [COUNT],
      omittedMeasures: [NPS],
    });
  });

  test("a pie needs one dimension and a count; an average or a trend is refused", () => {
    expect(expectOk({ measures: [COUNT], dimensions: [SENTIMENT] }, { type: "pie" }).spec).toMatchObject({
      type: "pie",
      x: SENTIMENT,
      y: [COUNT],
    });
    expect(
      expectRefused({ measures: [NPS], dimensions: [SENTIMENT] }, { type: "pie" }).invalidParams[0]
    ).toMatchObject({ name: "chart.y" });
    expect(
      expectRefused(
        { measures: [COUNT], timeDimensions: [{ dimension: COLLECTED, granularity: "day" }] },
        { type: "pie" }
      ).detail
    ).toContain("trend over time");
    expect(
      expectRefused({ measures: [COUNT], dimensions: [SENTIMENT, LABEL] }, { type: "pie", x: SENTIMENT })
        .invalidParams[0]
    ).toMatchObject({ name: "chart.type" });
  });

  test("a bar, line or area needs something to put on the x axis, and a measure", () => {
    expect(expectRefused({ measures: [COUNT] }, { type: "bar" }).detail).toContain("dimension");
    expect(expectRefused({ dimensions: [SENTIMENT] }, { type: "line" }).detail).toContain("measure");
  });

  test("a table takes no axis hints", () => {
    expect(
      expectRefused({ measures: [COUNT], dimensions: [LABEL] }, { type: "table", x: LABEL }).detail
    ).toContain("table");
    expect(expectOk({ measures: [COUNT], dimensions: [LABEL] }, { type: "table" }).spec.type).toBe("table");
  });

  test("area is drawn like a line over the same axes", () => {
    expect(
      expectOk(
        { measures: [COUNT], timeDimensions: [{ dimension: COLLECTED, granularity: "day" }] },
        { type: "area" }
      ).spec
    ).toMatchObject({ type: "area", xKind: "time" });
  });
});

describe("title", () => {
  test("defaults to the measures by the grouping fields, and a hint overrides it", () => {
    expect(expectOk({ measures: [NPS], dimensions: [SENTIMENT] }).spec.title).toBe("NPS: Score by sentiment");
    expect(
      expectOk({ measures: [COUNT], timeDimensions: [{ dimension: COLLECTED, granularity: "month" }] }).spec
        .title
    ).toBe("Feedback Records by month");
    expect(expectOk({ measures: [NPS], dimensions: [SENTIMENT] }, { title: "Mood" }).spec.title).toBe("Mood");
  });
});
