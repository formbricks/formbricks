import { describe, expect, test } from "vitest";
import { parseFeedbackChart, readChartError, readChartErrorStatus } from "./model";

const valid = {
  datasetId: "ds1",
  datasetName: "Main",
  query: { limit: 100 },
  chart: { type: "bar", title: "T", x: "d", xKind: "category", y: ["m"] },
  columns: [
    { id: "d", label: "Sentiment", kind: "dimension" },
    { id: "m", label: "NPS: Score", kind: "measure", domain: [-100, 100] },
  ],
  rows: [{ d: "positive", m: 4 }],
  truncated: true,
};

describe("parseFeedbackChart", () => {
  test("reads a well-formed result", () => {
    const model = parseFeedbackChart(valid);
    expect(model?.spec).toMatchObject({ type: "bar", title: "T", x: "d", xKind: "category", y: ["m"] });
    expect(model?.columns[1].domain).toEqual([-100, 100]);
    expect(model?.rows).toEqual([{ d: "positive", m: 4 }]);
    expect(model?.truncated).toBe(true);
    expect(model?.datasetName).toBe("Main");
    expect(model?.datasetId).toBe("ds1");
  });

  test("is undefined for anything that is not a chart result", () => {
    expect(parseFeedbackChart(undefined)).toBeUndefined();
    expect(parseFeedbackChart({})).toBeUndefined();
    expect(parseFeedbackChart({ ...valid, chart: { ...valid.chart, type: "radar" } })).toBeUndefined();
    expect(parseFeedbackChart({ ...valid, rows: "nope" })).toBeUndefined();
    expect(parseFeedbackChart({ ...valid, rows: [1] })).toBeUndefined();
    expect(parseFeedbackChart({ ...valid, columns: [{ id: "d" }] })).toBeUndefined();
    expect(parseFeedbackChart({ ...valid, chart: { ...valid.chart, y: "m" } })).toBeUndefined();
  });

  test("turns a nested value into null and drops a bad domain or granularity", () => {
    const model = parseFeedbackChart({
      ...valid,
      chart: { ...valid.chart, granularity: "decade" },
      columns: [
        { id: "d", label: "Sentiment", kind: "dimension" },
        { id: "m", label: "M", kind: "measure", domain: [1] },
      ],
      rows: [{ d: { nested: true }, m: 1 }],
    });
    expect(model?.rows[0].d).toBeNull();
    expect(model?.columns[1].domain).toBeUndefined();
    expect(model?.spec.granularity).toBeUndefined();
  });
});

describe("readChartError", () => {
  test("reads the nested detail the server sends and never the JSON text", () => {
    const result = {
      isError: true,
      content: [{ type: "text", text: '{"error":{"detail":"x"}}' }],
      structuredContent: {
        error: { status: 403, title: "Forbidden", detail: "Feedback analytics is not enabled." },
      },
    };
    expect(readChartError(result)).toBe("Feedback analytics is not enabled.");
    expect(readChartErrorStatus(result)).toBe(403);
  });

  test("falls back to plain text, then to a generic sentence", () => {
    expect(readChartError({ isError: true, content: [{ type: "text", text: "Boom" }] })).toBe("Boom");
    expect(readChartError({ isError: true, content: [{ type: "text", text: '{"a":1}' }] })).toBe(
      "The query could not be run."
    );
    expect(readChartError({ isError: true, structuredContent: { detail: "Top level" } })).toBe("Top level");
  });

  test("is undefined for a success", () => {
    expect(
      readChartError({ content: [{ type: "text", text: "ok" }], structuredContent: valid })
    ).toBeUndefined();
    expect(readChartError(null)).toBeUndefined();
    expect(readChartErrorStatus(null)).toBeUndefined();
  });
});
