import { describe, expect, test } from "vitest";
import { buildSampleExport } from "./__fixtures__/sample-export";
import type { TUnmappedValue } from "./types";
import { UNMAPPED_HEADERS, buildUnmappedValuesTable, unmappedColumnNames } from "./unmapped-values";

const value = (overrides: Partial<TUnmappedValue> = {}): TUnmappedValue => ({
  column: "region",
  question: { id: "e3", code: "region", headline: "Where do you live?" },
  value: "Western Provnce",
  responseCount: 2,
  languages: ["ar", "en"],
  closest: { code: "02", label: "Western Province", similarity: 0.94 },
  reason: "no_match",
  responseIds: ["r1", "r2"],
  responseIdsTruncated: false,
  ...overrides,
});

describe("UNMAPPED_HEADERS", () => {
  test("are fixed English, in the order of the ticket", () => {
    expect(UNMAPPED_HEADERS).toEqual([
      "Column",
      "Question text",
      "Unmapped value",
      "Responses",
      "Languages",
      "Closest option",
      "Closest code",
      "Similarity",
      "Likely cause",
      "Response IDs",
      "Question ID",
    ]);
  });
});

describe("buildUnmappedValuesTable", () => {
  test("one row per unmapped value, with a near miss named as slightly different wording", () => {
    expect(buildUnmappedValuesTable({ unmapped: [value()], unmappedDropped: 0 })).toEqual([
      [
        "region",
        "Where do you live?",
        "Western Provnce",
        2,
        "ar, en",
        "Western Province",
        "02",
        "94%",
        "wording differs slightly from Western Province",
        "r1, r2",
        "e3",
      ],
    ]);
  });

  test("90% is the line between the two causes, and there are only two", () => {
    const cause = (similarity: number) =>
      buildUnmappedValuesTable({
        unmapped: [value({ closest: { code: "02", label: "Western Province", similarity } })],
        unmappedDropped: 0,
      })[0][8];
    expect(cause(0.9)).toBe("wording differs slightly from Western Province");
    expect(cause(0.89)).toBe("no similar option");
    expect(cause(0)).toBe("no similar option");
  });

  test("a question with no option to compare with has blank closest cells and no similar option", () => {
    const rows = buildUnmappedValuesTable({
      unmapped: [value({ closest: null, reason: "not_a_number", value: "n/a" })],
      unmappedDropped: 0,
    });
    expect(rows[0].slice(5, 9)).toEqual([null, null, null, "no similar option"]);
  });

  test("a closest option without a code leaves the code blank", () => {
    const rows = buildUnmappedValuesTable({
      unmapped: [value({ closest: { code: null, label: "Red", similarity: 0.5 } })],
      unmappedDropped: 0,
    });
    expect(rows[0].slice(5, 8)).toEqual(["Red", null, "50%"]);
  });

  test("response ids cut by the service say so", () => {
    const rows = buildUnmappedValuesTable({
      unmapped: [value({ responseIds: ["r1"], responseIdsTruncated: true })],
      unmappedDropped: 0,
    });
    expect(rows[0][9]).toBe("r1, ...");
  });

  test("values the service dropped past its cap end the list with a plain note", () => {
    const rows = buildUnmappedValuesTable({ unmapped: [value()], unmappedDropped: 7 });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      null,
      null,
      "7 more unmapped values are not listed.",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  test("an export with nothing unmapped has no rows", () => {
    expect(buildUnmappedValuesTable({ unmapped: [], unmappedDropped: 0 })).toEqual([]);
  });

  test("on the sample export the near miss and the far miss are both listed, worst count first per column", async () => {
    const exported = buildSampleExport("codes");
    for await (const batch of exported.rows()) void batch;
    const rows = buildUnmappedValuesTable(exported.summary());
    expect(rows.map((row) => [row[0], row[2], row[7], row[8], row[9]])).toEqual([
      ["region", "Somewhere else", "19%", "no similar option", "resp_2"],
      ["region", "Western Provnce", "94%", "wording differs slightly from Western Province", "resp_3"],
    ]);
  });
});

describe("unmappedColumnNames", () => {
  test("lists the columns that have unmapped values", () => {
    const names = unmappedColumnNames({
      unmapped: [value(), value({ column: "age" }), value({ column: "region", value: "x" })],
    });
    expect([...names].sort()).toEqual(["age", "region"]);
  });
});
