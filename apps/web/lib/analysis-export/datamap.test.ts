import { describe, expect, test } from "vitest";
import { buildSampleExport } from "./__fixtures__/sample-export";
import { DATAMAP_HEADERS, buildDatamap } from "./datamap";
import type { TAnalysisColumn } from "./types";

const BLANK = "Blank = not asked or not answered.";

describe("DATAMAP_HEADERS", () => {
  test("are fixed English, in the order of the ticket, with no Base column yet", () => {
    expect(DATAMAP_HEADERS).toEqual([
      "Column",
      "Question ID",
      "Question text",
      "Type",
      "Code",
      "Value label",
      "Notes",
    ]);
  });
});

describe("buildDatamap on the sample export", () => {
  const rows = buildDatamap(buildSampleExport("codes").columns);

  test("one row per column and code, one row for a column with no codes", () => {
    expect(rows).toEqual([
      ["response_id", null, "Response ID", "response info . id", null, null, "Never blank."],
      [
        "language",
        null,
        "Language",
        "response info . language code",
        null,
        null,
        "Blank = not recorded. The language the respondent answered in.",
      ],
      [
        "outcome",
        null,
        "Outcome",
        "response info . outcome",
        null,
        null,
        "Blank = normal response. lowQuality = marked Low quality.",
      ],
      [
        "timestamp",
        null,
        "Timestamp",
        "response info . timestamp",
        null,
        null,
        "Never blank. When the response was created, in the time zone written after the time (UTC).",
      ],
      ["finished", null, "Finished", "response info . 1/0", "1", "Finished", "Never blank."],
      ["finished", null, "Finished", "response info . 1/0", "0", "Not finished", "Never blank."],
      ["colour", "e1", "Which colour do you prefer?", "single select . code", "1", "Red", BLANK],
      ["colour", "e1", "Which colour do you prefer?", "single select . code", "2", "Blue", BLANK],
      ["colour", "e1", "Which colour do you prefer?", "single select . code", "3", "Green", BLANK],
      ...["apple", "banana", "cherry"].flatMap((option) => {
        const label = option[0].toUpperCase() + option.slice(1);
        const note = `${BLANK} 0 = answered without this option.`;
        const text = "Which fruit do you eat? (it's a long one)";
        return [
          [`fruit_${option}`, "e2", text, "multi select . 1/0", "1", `Selected: ${label}`, note],
          [`fruit_${option}`, "e2", text, "multi select . 1/0", "0", `Not selected: ${label}`, note],
        ];
      }),
      ["region", "e3", "Where do you live?", "single select . code", "01", "Central Province", BLANK],
      ["region", "e3", "Where do you live?", "single select . code", "02", "Western Province", BLANK],
      ["region", "e3", "Where do you live?", "single select . code", "98", "Eastern Province", BLANK],
      ...Array.from({ length: 11 }, (_, point) => [
        "nps",
        "e4",
        "How likely are you to recommend us?",
        "nps . 0-10",
        String(point),
        point === 0 ? "Lowest" : point === 10 ? "Highest" : null,
        BLANK,
      ]),
      ["feedback", "e5", "Tell us more", "open text . text", null, null, BLANK],
      [
        "rank_price",
        "e6",
        "Rank these",
        "ranking . rank",
        null,
        null,
        `${BLANK} The rank given to Price, 1 is first.`,
      ],
      [
        "rank_speed",
        "e6",
        "Rank these",
        "ranking . rank",
        null,
        null,
        `${BLANK} The rank given to Speed, 1 is first.`,
      ],
      ["city", "e7", "في أي مدينة تسكن؟", "single select . code", "1", "الرياض", BLANK],
      ["city", "e7", "في أي مدينة تسكن؟", "single select . code", "2", "جدة", BLANK],
    ]);
  });
});

describe("notes and types for the other kinds of column", () => {
  const question = { id: "e9", code: "q9", type: "matrix", headline: "Rate the shop" };

  test("a column that holds UNMAPPED cells says so on every one of its rows", () => {
    const rows = buildDatamap(buildSampleExport("codes").columns, { unmappedColumns: new Set(["region"]) });
    const regionNotes = rows.filter((row) => row[0] === "region").map((row) => row[6]);
    expect(regionNotes).toEqual(
      Array(3).fill(
        `${BLANK} A cell that starts with UNMAPPED: holds an answer that matches no option, see the Unmapped values sheet.`
      )
    );
    expect(rows.filter((row) => row[0] === "colour").every((row) => row[6] === BLANK)).toBe(true);
  });

  test("a matrix row is one column that carries the matrix codes and names the row", () => {
    const column: TAnalysisColumn = {
      name: "q9_service",
      kind: "code",
      source: "question",
      question,
      matrixRow: { code: "service", label: "Service" },
      codes: [
        { code: "1", label: "Poor" },
        { code: "2", label: "Good" },
      ],
    };
    expect(buildDatamap([column])).toEqual([
      ["q9_service", "e9", "Rate the shop", "matrix . code", "1", "Poor", `${BLANK} Matrix row: Service.`],
      ["q9_service", "e9", "Rate the shop", "matrix . code", "2", "Good", `${BLANK} Matrix row: Service.`],
    ]);
  });

  test("scales get one row per point: csat 5-point and rating", () => {
    const csat: TAnalysisColumn = {
      name: "sat",
      kind: "number",
      source: "question",
      question: { id: "e7", code: "sat", type: "csat", headline: "Happy?" },
      scale: { range: 5 },
    };
    const rows = buildDatamap([csat]);
    expect(rows.map((row) => [row[3], row[4], row[5]])).toEqual([
      ["csat . 5-point", "1", "Lowest"],
      ["csat . 5-point", "2", null],
      ["csat . 5-point", "3", null],
      ["csat . 5-point", "4", null],
      ["csat . 5-point", "5", "Highest"],
    ]);
  });

  test("a number input is numeric and has no code rows", () => {
    const column: TAnalysisColumn = {
      name: "age",
      kind: "number",
      source: "question",
      question: { id: "e8", code: "age", type: "openText", headline: "How old are you?" },
    };
    expect(buildDatamap([column])).toEqual([
      ["age", "e8", "How old are you?", "numeric . number", null, null, BLANK],
    ]);
  });

  test("an Other text column and a picture selection flag are typed and explained", () => {
    const other: TAnalysisColumn = {
      name: "colour_text",
      kind: "other_text",
      source: "question",
      question: { id: "e1", code: "colour", type: "multipleChoiceSingle", headline: "Colour?" },
      option: { code: "98", label: "Other" },
    };
    const picture: TAnalysisColumn = {
      name: "logo_a",
      kind: "flag",
      source: "question",
      question: { id: "e2", code: "logo", type: "pictureSelection", headline: "Pick logos" },
      option: { code: "a", label: "Logo A" },
    };
    const rows = buildDatamap([other, picture]);
    expect(rows[0]).toEqual([
      "colour_text",
      "e1",
      "Colour?",
      "other text . text",
      null,
      null,
      `${BLANK} What was typed into Other.`,
    ]);
    expect(rows[1][3]).toBe("picture selection . 1/0");
    expect(rows[1][5]).toBe("Selected: Logo A");
  });

  test("Embedded Data and response info are listed with their types, booleans as true/false", () => {
    const embedded = (
      name: string,
      type: "string" | "number" | "boolean" | "date",
      origin: "hidden" | "variable" | "metadata"
    ): TAnalysisColumn => ({
      name,
      kind: type === "number" ? "number" : "text",
      source: "embedded",
      embedded: { type, origin, label: `Label of ${name}` },
    });
    const rows = buildDatamap([
      embedded("vip", "boolean", "hidden"),
      embedded("score", "number", "variable"),
      embedded("source", "string", "hidden"),
      embedded("seen", "date", "hidden"),
      embedded("country", "string", "metadata"),
    ]);
    expect(rows.map((row) => [row[0], row[1], row[2], row[3], row[4], row[6]])).toEqual([
      ["vip", null, "Label of vip", "embedded data . true/false", null, "Blank = not provided."],
      ["score", null, "Label of score", "embedded data . number", null, "Blank = not provided."],
      ["source", null, "Label of source", "embedded data . text", null, "Blank = not provided."],
      [
        "seen",
        null,
        "Label of seen",
        "embedded data . date",
        null,
        "Blank = not provided. Written as ISO 8601 text.",
      ],
      ["country", null, "Label of country", "response info . text", null, "Blank = not provided."],
    ]);
  });

  test("a code is text, so 007 and 01 are never numbers", () => {
    const column: TAnalysisColumn = {
      name: "q",
      kind: "code",
      source: "question",
      question: { id: "e1", code: "q", type: "multipleChoiceSingle", headline: "Q?" },
      codes: [{ code: "007", label: "Bond" }],
    };
    expect(typeof buildDatamap([column])[0][4]).toBe("string");
    expect(buildDatamap([column])[0][4]).toBe("007");
  });
});
