import { describe, expect, test } from "vitest";
import * as xlsx from "xlsx";
import { LONG_ARABIC_TEXT, buildSampleExport } from "./__fixtures__/sample-export";
import { buildAnalysisWorkbook } from "./analysis-workbook";
import { DATAMAP_HEADERS, buildDatamap } from "./datamap";
import { UNMAPPED_HEADERS } from "./unmapped-values";
import { XlsxLimitError } from "./xlsx-writer";

const open = async (display: "codes" | "text" | "both") =>
  xlsx.read(await buildAnalysisWorkbook(buildSampleExport(display), { display }), {
    type: "buffer",
    raw: true,
  });

const table = (book: xlsx.WorkBook, sheet: string) =>
  xlsx.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], { header: 1, blankrows: false, defval: null });

describe("buildAnalysisWorkbook", () => {
  test("Text and code has the four sheets, in order: Labels, Codes, Datamap, Unmapped values", async () => {
    expect((await open("both")).SheetNames).toEqual(["Labels", "Codes", "Datamap", "Unmapped values"]);
  });

  test("a single answer display has one data sheet, then Datamap and Unmapped values", async () => {
    expect((await open("codes")).SheetNames).toEqual(["Codes", "Datamap", "Unmapped values"]);
    expect((await open("text")).SheetNames).toEqual(["Labels", "Datamap", "Unmapped values"]);
  });

  test("the Codes sheet holds codes as text and counts as numbers, rows newest first as the service gives them", async () => {
    const book = await open("codes");
    const rows = table(book, "Codes");
    expect(rows[0]).toEqual([
      "response_id",
      "language",
      "outcome",
      "timestamp",
      "finished",
      "colour",
      "fruit_apple",
      "fruit_banana",
      "fruit_cherry",
      "region",
      "nps",
      "feedback",
      "rank_price",
      "rank_speed",
      "city",
    ]);
    expect(rows.slice(1).map((row) => row[0])).toEqual(["resp_1", "resp_2", "resp_3"]);
    // colour is Red = code "1", asked of resp_1; region 01 keeps its zero.
    expect(rows[1].slice(4, 11)).toEqual([1, "1", 1, 0, 1, "01", 9]);
    expect(book.Sheets.Codes.F2).toMatchObject({ t: "s", v: "1" });
    expect(book.Sheets.Codes.J2).toMatchObject({ t: "s", v: "01" });
    expect(book.Sheets.Codes.K2).toMatchObject({ t: "n", v: 9 });
  });

  test("an UNMAPPED cell is text, as given", async () => {
    const rows = table(await open("codes"), "Codes");
    expect(rows[2][9]).toBe("UNMAPPED:Somewhere else");
    expect(rows[3][9]).toBe("UNMAPPED:Western Provnce");
  });

  test("the Excel file keeps line breaks, quotes and Arabic; a formula-like text is defanged", async () => {
    const rows = table(await open("codes"), "Codes");
    expect(rows[1][11]).toBe('He said "hello"\nsecond line, with a comma');
    expect(rows[2][11]).toBe(LONG_ARABIC_TEXT);
    expect(rows[3][11]).toBe("'=SUM(A1:A9)");
  });

  test("the Labels sheet of Text and code reads `column; Question text` and holds the answer text", async () => {
    const rows = table(await open("both"), "Labels");
    expect(rows[0].slice(5, 7)).toEqual([
      "colour; Which colour do you prefer?",
      "fruit_apple; Which fruit do you eat? (it's a long one)",
    ]);
    expect(rows[1].slice(5, 11)).toEqual(["Red", 1, 0, 1, "Central Province", 9]);
    expect(rows[2][5]).toBe("أزرق");
  });

  test("the Datamap sheet is the datamap, with the UNMAPPED note on the column that holds them", async () => {
    const exported = buildSampleExport("codes");
    const book = await open("codes");
    const rows = table(book, "Datamap");
    expect(rows[0]).toEqual([...DATAMAP_HEADERS]);
    const regionNotes = rows.filter((row) => row[0] === "region").map((row) => row[6]);
    expect(regionNotes.every((note) => String(note).includes("UNMAPPED:"))).toBe(true);
    // Same rows as the pure builder, apart from the note that needs the drained summary.
    expect(rows.length - 1).toBe(buildDatamap(exported.columns).length);
  });

  test("the Unmapped values sheet lists the values the rows turned up", async () => {
    const rows = table(await open("codes"), "Unmapped values");
    expect(rows[0]).toEqual([...UNMAPPED_HEADERS]);
    expect(rows.slice(1).map((row) => [row[2], row[3], row[8]])).toEqual([
      ["Somewhere else", 1, "no similar option"],
      ["Western Provnce", 1, "wording differs slightly from Western Province"],
    ]);
  });

  test("an export with no responses is still a valid workbook: headers only", async () => {
    const empty = buildSampleExport("codes");
    const book = xlsx.read(
      await buildAnalysisWorkbook(
        {
          ...empty,
          rows: async function* () {},
          summary: () => ({ rowCount: 0, unmapped: [], unmappedDropped: 0 }),
        },
        { display: "codes" }
      ),
      { type: "buffer" }
    );
    expect(table(book, "Codes")).toHaveLength(1);
    expect(table(book, "Unmapped values")).toEqual([[...UNMAPPED_HEADERS]]);
  });

  test("maxCells refuses a workbook that would be too big before reading a single row", async () => {
    let read = false;
    const exported = buildSampleExport("both");
    const spy = {
      ...exported,
      rows: async function* () {
        read = true;
        yield* exported.rows();
      },
    };
    // 15 columns x (3 included + 1 header) x 2 data sheets = 120 cells.
    await expect(buildAnalysisWorkbook(spy, { display: "both", maxCells: 119 })).rejects.toThrow(
      XlsxLimitError
    );
    expect(read).toBe(false);
    await expect(
      buildAnalysisWorkbook(buildSampleExport("both"), { display: "both", maxCells: 5000 })
    ).resolves.toBeInstanceOf(Buffer);
  });

  test("maxCells also stops a workbook whose counts were low but whose rows were not", async () => {
    const exported = buildSampleExport("codes");
    const lying = { ...exported, counts: { included: 0, lowQualityLeftOut: 0 } };
    await expect(buildAnalysisWorkbook(lying, { display: "codes", maxCells: 20 })).rejects.toThrow(
      XlsxLimitError
    );
  });

  test("include leaves out the Datamap and the Unmapped values sheets when they are off", async () => {
    const book = xlsx.read(
      await buildAnalysisWorkbook(buildSampleExport("both"), {
        display: "both",
        include: { datamap: false, unmappedValues: false },
      }),
      { type: "buffer", raw: true }
    );
    expect(book.SheetNames).toEqual(["Labels", "Codes"]);
    const onlyDatamap = xlsx.read(
      await buildAnalysisWorkbook(buildSampleExport("codes"), {
        display: "codes",
        include: { datamap: true, unmappedValues: false },
      }),
      { type: "buffer", raw: true }
    );
    expect(onlyDatamap.SheetNames).toEqual(["Codes", "Datamap"]);
  });
});
