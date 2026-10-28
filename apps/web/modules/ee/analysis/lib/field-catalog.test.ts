import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { CHART_DATE_PRESETS, CHART_FIELD_CATALOG, getChartField } from "./field-catalog";

/** Every member the Cube model defines, read off the schema file the Cube image serves. */
const cubeSchema = readFileSync(
  resolve(process.cwd(), "../../docker/cube/schema/FeedbackRecords.js"),
  "utf8"
);
const cubeMembers = [...cubeSchema.matchAll(/^ {4}(\w+): \{$/gm)].map(
  (match) => `FeedbackRecords.${match[1]}`
);

describe("field catalog (ENG-6584)", () => {
  test("lists no hidden member: not the tenant id, not the internal record id, no normalized companion", () => {
    const names = CHART_FIELD_CATALOG.map((field) => field.name);

    expect(names).not.toContain("FeedbackRecords.tenantId");
    expect(names).not.toContain("FeedbackRecords.id");
    expect(names.filter((name) => name.endsWith("Normalized"))).toEqual([]);
    // The Cube model really does define them, so this asserts a choice rather than an absence.
    expect(cubeMembers).toEqual(
      expect.arrayContaining([
        "FeedbackRecords.tenantId",
        "FeedbackRecords.id",
        "FeedbackRecords.valueTextNormalized",
      ])
    );
  });

  test("lists only members the Cube model defines, each once", () => {
    const names = CHART_FIELD_CATALOG.map((field) => field.name);

    expect(names.filter((name) => !cubeMembers.includes(name))).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
  });

  test("names every field with its data-source prefix and classifies time dimensions", () => {
    expect(CHART_FIELD_CATALOG.every((field) => field.name.startsWith("FeedbackRecords."))).toBe(true);
    expect(getChartField("FeedbackRecords.collectedAt")).toMatchObject({
      kind: "timeDimension",
      type: "time",
      granularities: expect.arrayContaining(["day", "month"]),
    });
    expect(getChartField("FeedbackRecords.npsScore")).toMatchObject({ kind: "measure", type: "number" });
    expect(getChartField("FeedbackRecords.sourceName")).toMatchObject({
      kind: "dimension",
      valueLookup: true,
    });
    expect(getChartField("FeedbackRecords.valueText")).toMatchObject({ valueLookup: false });
  });

  test("offers the app's presets plus all-time as date ranges", () => {
    expect(CHART_DATE_PRESETS).toEqual([...DATE_RANGE_PRESETS, "all-time"]);
  });
});
