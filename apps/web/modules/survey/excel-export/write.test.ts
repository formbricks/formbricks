import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { walkSurveyTexts } from "@/modules/survey/lib/survey-texts";
import { createIcuTranslate } from "./__fixtures__/translate";
import { EXCEL_EXPORT_META_SHEET } from "./format";
import { writeExcelExport } from "./write";

const t = createIcuTranslate("en-US");
const UPDATED_AT = new Date("2026-10-30T12:34:56.000Z");

const SURVEY = {
  ...EVERY_TEXT_SURVEY,
  updatedAt: UPDATED_AT,
  blocks: [
    EVERY_TEXT_SURVEY.blocks[0],
    {
      ...EVERY_TEXT_SURVEY.blocks[1],
      logic: [
        {
          id: "clrule000000000000000001",
          conditions: {
            id: "clgroup00000000000000001",
            connector: "and",
            conditions: [
              {
                id: "clcond000000000000000001",
                leftOperand: { type: "element", value: "multi" },
                operator: "includesOneOf",
                rightOperand: { type: "static", value: ["red"] },
              },
            ],
          },
          actions: [{ id: "clact0000000000000000001", objective: "jumpToBlock", target: "ending-thanks" }],
        },
      ],
      logicFallback: "block-1",
    },
  ],
} as unknown as TSurvey;

/** The bytes parsed back the way a reviewer's spreadsheet app would read them, formulas included. */
const readBack = (bytes: Uint8Array) =>
  XLSX.read(bytes, { type: "array", cellFormula: true, cellNF: true, cellStyles: true, cellHTML: false });

const rowsOf = (sheet: XLSX.WorkSheet): string[][] =>
  XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

const export_ = (survey: TSurvey = SURVEY) => readBack(writeExcelExport({ survey, t, locale: "en-US" }));

describe("writeExcelExport", () => {
  test("writes a header of key, Question ID, Type, one column per language with the default first, and Logic", () => {
    const [header] = rowsOf(export_().Sheets.Survey);
    expect(header).toEqual(["key", "Question ID", "Type", "English (en) — default", "German (de)", "Logic"]);
  });

  test("writes one row per text with content, keyed by the walker's id-built key, in survey order", () => {
    const [, ...rows] = rowsOf(export_().Sheets.Survey);
    const keys = rows.map((row) => row[0]);

    expect(keys).toEqual(
      walkSurveyTexts(SURVEY)
        .map((text) => text.key)
        // Stored without a default: an empty address line and a picture without alt text never show.
        .filter((key) => key !== "element.address.addressLine2.placeholder")
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("names each row's question and what the row is, and puts each language's text in its column", () => {
    const rows = new Map(rowsOf(export_().Sheets.Survey).map((row) => [row[0], row.slice(1)]));

    expect(rows.get("welcomeCard.headline")).toEqual([
      "",
      "Welcome card: Headline",
      "Welcome",
      "Willkommen",
      "",
    ]);
    expect(rows.get("block.block-1.buttonLabel")).toEqual([
      "",
      "Block 1: Button label",
      "Next",
      "Weiter",
      "",
    ]);
    expect(rows.get("element.single.headline")).toEqual([
      "single",
      "Single-Select",
      "Pick one",
      "Wähle eins",
      "",
    ]);
    expect(rows.get("element.single.choice.no.label")).toEqual(["single", "Choice 2", "No", "Nein", ""]);
    expect(rows.get("element.matrix.column.col-good.label")).toEqual([
      "matrix",
      "Column 2",
      "Good",
      "Gut",
      "",
    ]);
    expect(rows.get("element.contact.email.placeholder")?.slice(0, 4)).toEqual([
      "contact",
      "Email Placeholder",
      "Email",
      "E-Mail",
    ]);
    expect(rows.get("ending.ending-thanks.headline")).toEqual([
      "ending-thanks",
      "Ending 1: Headline",
      "Thank you!",
      "Danke!",
      "",
    ]);
    // A translation the survey doesn't have stays an empty cell.
    expect(rows.get("element.csat.lowerLabel")?.slice(2, 4)).toEqual(["Unhappy", ""]);
    // Rich text as words.
    expect(rows.get("welcomeCard.subheader")?.slice(2, 4)).toEqual([
      "Glad you are here",
      "Schön, dass du da bist",
    ]);
  });

  test("names an address or contact info field the way the editor does, in the export's language", () => {
    const rowOf = (locale: string, key: string) => {
      const workbook = readBack(writeExcelExport({ survey: SURVEY, t: createIcuTranslate(locale), locale }));
      // The sheet's name is translated too; the survey's sheet is the first.
      const rows = rowsOf(workbook.Sheets[workbook.SheetNames[0]]);
      return new Map(rows.map((row) => [row[0], row])).get(key);
    };

    expect(rowOf("en-US", "element.address.addressLine1.placeholder")?.[2]).toBe(
      "Address Line 1 Placeholder"
    );
    expect(rowOf("de-DE", "element.address.addressLine1.placeholder")?.[2]).toBe(
      "Platzhalter für Adresszeile 1"
    );
  });

  test("puts a block's logic in plain words on its first question's row", () => {
    const rows = rowsOf(export_().Sheets.Survey);
    const withLogic = rows.filter((row) => row[5] !== "" && row[0] !== "key");

    expect(withLogic.map((row) => [row[0], row[5]])).toEqual([
      [
        "element.multi.headline",
        "If question “Pick many” includes one of “Red”, then jump to the ending “Thank you!”.\nOtherwise, jump to question “What should we improve?”.",
      ],
    ]);
  });

  test("writes every cell as typed text in text format, none of them a formula", () => {
    const survey = {
      ...SURVEY,
      welcomeCard: {
        ...SURVEY.welcomeCard,
        headline: { default: '=HYPERLINK("https://evil.example","Click")', de: "+1" },
        buttonLabel: { default: "0042", de: "1e5" },
      },
    } as TSurvey;
    const workbook = export_(survey);

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const cells = Object.entries(sheet).filter(([address]) => !address.startsWith("!"));
      expect(cells.length).toBeGreaterThan(0);
      for (const [address, cell] of cells) {
        expect({ address, t: cell.t, z: cell.z, f: cell.f }).toEqual({
          address,
          t: "s",
          z: "@",
          f: undefined,
        });
      }
    }

    const rows = new Map(rowsOf(workbook.Sheets.Survey).map((row) => [row[0], row]));
    expect(rows.get("welcomeCard.headline")?.slice(3, 5)).toEqual([
      '=HYPERLINK("https://evil.example","Click")',
      "+1",
    ]);
    expect(rows.get("welcomeCard.buttonLabel")?.slice(3, 5)).toEqual(["0042", "1e5"]);
  });

  test("stores texts as plain strings, never as a formula's cached result", () => {
    const archive = XLSX.CFB.read(writeExcelExport({ survey: SURVEY, t, locale: "en-US" }), {
      type: "array",
    });
    const sheetXml = (path: string) =>
      new TextDecoder().decode(XLSX.CFB.find(archive, path)?.content as Uint8Array);

    for (const path of ["/xl/worksheets/sheet1.xml", "/xl/worksheets/sheet2.xml"]) {
      expect(sheetXml(path)).toContain('t="s"');
      expect(sheetXml(path)).not.toContain('t="str"');
      expect(sheetXml(path)).not.toContain("<f>");
    }
  });

  test("hides the key column, and says how to read the sheet back on a very hidden sheet that names no survey", () => {
    const workbook = export_();

    expect(workbook.SheetNames).toEqual(["Survey", EXCEL_EXPORT_META_SHEET]);
    expect(workbook.Workbook?.Sheets?.map((sheet) => sheet.Hidden)).toEqual([0, 2]);
    expect(workbook.Sheets.Survey["!cols"]?.[0]?.hidden).toBe(true);
    expect(workbook.Sheets.Survey["!cols"]?.slice(1).some((column) => column.hidden)).toBe(false);
    const [, , ...languageHeaders] = rowsOf(workbook.Sheets.Survey)[0].slice(0, -1);
    expect(rowsOf(workbook.Sheets[EXCEL_EXPORT_META_SHEET])).toEqual([
      ["format", "1", ""],
      ["languages", "en", "de"],
      ["headers", ...languageHeaders.slice(1)],
      ["columns", "Question ID", "Type"],
      ["locale", "en-US", ""],
    ]);
    // The file never says which survey it came from: the import is aimed at one (ENG-6809).
    const metaText = JSON.stringify(rowsOf(workbook.Sheets[EXCEL_EXPORT_META_SHEET]));
    expect(metaText).not.toContain(SURVEY.id);
    expect(metaText).not.toContain(UPDATED_AT.toISOString());
  });

  test("cuts a text past 32,767 characters to fit, marked as cut, and keeps its row", () => {
    const survey = {
      ...SURVEY,
      welcomeCard: { ...SURVEY.welcomeCard, headline: { default: "x".repeat(40_000), de: "Kurz" } },
    } as TSurvey;
    const row = rowsOf(export_(survey).Sheets.Survey).find((cells) => cells[0] === "welcomeCard.headline");

    expect(row?.[3]).toHaveLength(32_767);
    expect(row?.[3].endsWith("x… [truncated]")).toBe(true);
    expect(row?.[4]).toBe("Kurz");
  });

  test("shows recall tokens as @Label in each language's column", () => {
    const survey = {
      ...SURVEY,
      endings: [
        {
          ...SURVEY.endings[0],
          headline: {
            default: "Thanks for #recall:single/fallback:it#!",
            de: "Danke für #recall:single/fallback:es#!",
          },
        },
      ],
    } as TSurvey;
    const row = rowsOf(export_(survey).Sheets.Survey).find(
      (cells) => cells[0] === "ending.ending-thanks.headline"
    );

    expect(row?.slice(3, 5)).toEqual(["Thanks for @Pick one!", "Danke für @Wähle eins!"]);
  });

  test("keeps the language columns in one order whatever order the survey's languages come back in", () => {
    // A survey stores no order for its languages, so the database may return them in any.
    const [english, german] = SURVEY.languages;
    const language = (code: string) => ({ ...german, language: { ...german.language, code, alias: null } });
    const shuffled = { ...SURVEY, languages: [language("ja"), german, language("fr"), english] } as TSurvey;

    const [header] = rowsOf(export_(shuffled).Sheets.Survey);

    expect(header).toEqual([
      "key",
      "Question ID",
      "Type",
      "English (en) — default",
      "German (de)",
      "French (fr)",
      "Japanese (ja)",
      "Logic",
    ]);
  });

  test("writes one Text column for a survey without languages", () => {
    const [header, firstRow] = rowsOf(export_({ ...SURVEY, languages: [] } as TSurvey).Sheets.Survey);

    expect(header).toEqual(["key", "Question ID", "Type", "Text", "Logic"]);
    expect(firstRow).toEqual(["welcomeCard.headline", "", "Welcome card: Headline", "Welcome", ""]);
  });
});
