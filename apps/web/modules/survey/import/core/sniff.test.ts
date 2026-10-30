import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  V3_REQUEST_ARRAY_MAX_ITEMS,
  V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS,
  V3_REQUEST_MAX_DEPTH,
} from "@/app/api/v3/lib/array-budget";
import { SURVEY_IMPORT_ZIP_MAX_ENTRIES } from "../limits";
import type { TSurveyImportFileLimit } from "../types";
import { zipOf } from "./__fixtures__/zip-builders";
import {
  SurveyImportFileTooLargeError,
  SurveyImportInputError,
  SurveyImportUnsupportedFileError,
} from "./errors";
import { sniffSurveyImportFile } from "./sniff";

const QSF_FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "../qsf/__fixtures__/simple.qsf");
const DOCUMENT_FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../document/__fixtures__");

const encode = (text: string) => new TextEncoder().encode(text);
const json = (value: unknown) => encode(JSON.stringify(value));

/** The first bytes of every Compound File Binary document: a Word 97–2003 `.doc` or Excel `.xls`. */
const CFB_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const legacyOffice = () => {
  const bytes = new Uint8Array(512);
  bytes.set(CFB_HEADER);
  return bytes;
};

const docx = () =>
  zipOf({
    "[Content_Types].xml": "<Types/>",
    "_rels/.rels": "<Relationships/>",
    "word/document.xml": "<w:document/>",
  });
const xlsx = () =>
  zipOf({
    "[Content_Types].xml": "<Types/>",
    "_rels/.rels": "<Relationships/>",
    "xl/workbook.xml": "<workbook/>",
    "xl/worksheets/sheet1.xml": "<worksheet/>",
  });

const refusal = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the file to be refused");
};

const expectUnsupported = (bytes: Uint8Array, identifier?: string) => {
  const error = refusal(() => sniffSurveyImportFile(bytes));
  expect(error).toBeInstanceOf(SurveyImportUnsupportedFileError);
  const [param] = (error as SurveyImportUnsupportedFileError).invalidParams;
  expect(param).toMatchObject({ name: "file", code: "file_type_unsupported" });
  expect(param.identifier).toBe(identifier);
  return param;
};

const expectUnreadable = (bytes: Uint8Array) => {
  const error = refusal(() => sniffSurveyImportFile(bytes));
  expect(error).toBeInstanceOf(SurveyImportInputError);
  expect((error as SurveyImportInputError).invalidParams).toEqual([
    expect.objectContaining({ name: "file", code: "file_unreadable" }),
  ]);
};

const expectJsonLimit = (bytes: Uint8Array, limit: TSurveyImportFileLimit, name: string) => {
  const error = refusal(() => sniffSurveyImportFile(bytes));
  expect(error).toBeInstanceOf(SurveyImportInputError);
  expect((error as SurveyImportInputError).invalidParams).toEqual([
    expect.objectContaining({ name, code: "file_limit_exceeded", identifier: limit }),
  ]);
};

describe("sniffSurveyImportFile: the type comes from the content", () => {
  test("reads a Qualtrics export by its JSON shape", () => {
    const file = sniffSurveyImportFile(readFileSync(QSF_FIXTURE));

    expect(file.type).toBe("qsf");
    expect(file).toMatchObject({ json: { SurveyEntry: { SurveyName: "Customer feedback" } } });
  });

  test("reads a Qualtrics export that starts with a byte-order mark", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...readFileSync(QSF_FIXTURE)]);

    expect(sniffSurveyImportFile(withBom).type).toBe("qsf");
  });

  test("reads a Formbricks file by its envelope", () => {
    const file = sniffSurveyImportFile(json({ formbricks: { format: 1 }, survey: {}, references: {} }));

    expect(file.type).toBe("formbricks");
  });

  test("tells a .docx from a .xlsx by the archive's layout", () => {
    expect(sniffSurveyImportFile(docx()).type).toBe("docx");
    expect(sniffSurveyImportFile(xlsx()).type).toBe("xlsx");
  });

  test("hands a .docx or .xlsx over as an archive its lane can read", () => {
    const file = sniffSurveyImportFile(docx());

    expect(
      file.type === "docx" && new TextDecoder().decode(file.archive.read("word/document.xml") ?? undefined)
    ).toBe("<w:document/>");
  });

  test("reads text that is neither JSON nor binary as a CSV, whatever its delimiter", () => {
    const file = sniffSurveyImportFile(encode("Frage;Typ\nWie zufrieden sind Sie?;Bewertung\n"));

    expect(file).toEqual({
      type: "csv",
      text: "Frage;Typ\nWie zufrieden sind Sie?;Bewertung\n",
      encoding: "utf-8",
    });
  });

  test("refuses a .doc or .xls with a 415 that says to save it as .docx or .xlsx", () => {
    const param = expectUnsupported(legacyOffice(), "legacy_office");

    expect(param.reason).toBe("Save the file as .docx or .xlsx");
  });

  test("refuses an archive that is neither a .docx nor a .xlsx", () => {
    expectUnsupported(zipOf({ "[Content_Types].xml": "<Types/>", "ppt/presentation.xml": "<p/>" }));
    expectUnsupported(zipOf({ "word/document.xml": "<w/>", "xl/workbook.xml": "<x/>" }));
  });

  test("refuses JSON of any other shape", () => {
    expectUnsupported(json({ blocks: [], name: "Just a v3 document" }));
    expectUnsupported(json([{ SurveyEntry: {} }]));
    expectUnsupported(json({ formbricks: "1" }));
  });

  test("refuses binary content that is no type the import reads", () => {
    expectUnsupported(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff, 0xfe, 0x00])); // %PDF- …
    expectUnsupported(encode("a,b\u0000c\n"));
  });

  test("refuses an empty file and broken JSON as unreadable", () => {
    expectUnreadable(new Uint8Array(0));
    expectUnreadable(encode('{"SurveyEntry": {"SurveyName": "Cut off'));
  });

  test("holds an archive to the zip limits before telling its type", () => {
    const entries = Object.fromEntries(
      Array.from({ length: SURVEY_IMPORT_ZIP_MAX_ENTRIES + 1 }, (_, index) => [`word/part-${index}.xml`, ""])
    );

    const error = refusal(() => sniffSurveyImportFile(zipOf(entries)));
    expect(error).toBeInstanceOf(SurveyImportFileTooLargeError);
  });
});

describe("sniffSurveyImportFile: a text file's encoding", () => {
  const fixture = (name: string) => new Uint8Array(readFileSync(join(DOCUMENT_FIXTURES, name)));

  test("reads a CSV Excel saved as Windows-1252, umlauts and the euro sign included", () => {
    const file = sniffSurveyImportFile(fixture("budget-cp1252.csv"));

    expect(file).toMatchObject({ type: "csv", encoding: "windows-1252" });
    expect(file.type === "csv" && file.text.split("\r\n")[1]).toBe(
      "1;Wie groß ist Ihr Budget in €?;Unter 100 € / Über 100 €"
    );
  });

  test("reads UTF-16 behind its byte-order mark, little- and big-endian, the mark dropped", () => {
    const little = sniffSurveyImportFile(fixture("visit-utf16le-bom.csv"));
    expect(little).toMatchObject({ type: "csv", encoding: "utf-16le" });
    expect(little.type === "csv" && little.text.startsWith("No,Question,Options\n1,Café")).toBe(true);

    const text = "No,Question\n1,¿Qué tal?\n";
    const big = new Uint8Array(2 + text.length * 2);
    big.set([0xfe, 0xff]);
    [...text].forEach((character, index) => {
      big[2 + index * 2] = character.charCodeAt(0) >> 8;
      big[3 + index * 2] = character.charCodeAt(0) & 0xff;
    });
    expect(sniffSurveyImportFile(big)).toEqual({ type: "csv", text, encoding: "utf-16be" });
  });

  test("reads UTF-8 with or without a byte-order mark as UTF-8, the mark dropped", () => {
    const withMark = new Uint8Array([0xef, 0xbb, 0xbf, ...encode("Größe;Preis\n")]);

    expect(sniffSurveyImportFile(withMark)).toEqual({
      type: "csv",
      text: "Größe;Preis\n",
      encoding: "utf-8",
    });
  });

  test("refuses bytes that decode only to control characters as no text file, with a 415", () => {
    // Not UTF-8 (0xff), and a SOH byte, which no Windows-1252 text holds.
    expectUnsupported(new Uint8Array([0x61, 0x3b, 0xff, 0x01, 0x0a]));
    // Tab, carriage return and line feed are text.
    expect(sniffSurveyImportFile(new Uint8Array([0x61, 0x09, 0xe4, 0x0d, 0x0a]))).toMatchObject({
      encoding: "windows-1252",
      text: "a\tä\r\n",
    });
  });
});

describe("sniffSurveyImportFile: the JSON budget, before the file is parsed", () => {
  const qsfWith = (elements: unknown[]) => json({ SurveyEntry: {}, SurveyElements: elements });

  test(`takes an array of ${V3_REQUEST_ARRAY_MAX_ITEMS} items and refuses one more, naming the array`, () => {
    expect(
      sniffSurveyImportFile(qsfWith(Array.from({ length: V3_REQUEST_ARRAY_MAX_ITEMS }, () => 0))).type
    ).toBe("qsf");
    expectJsonLimit(
      qsfWith(Array.from({ length: V3_REQUEST_ARRAY_MAX_ITEMS + 1 }, () => 0)),
      "array_items",
      "file.SurveyElements"
    );
  });

  test(`takes ${V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS} array elements in all and refuses one more`, () => {
    const arrays = (total: number) => {
      const full = Math.floor(total / V3_REQUEST_ARRAY_MAX_ITEMS);
      const rest = total % V3_REQUEST_ARRAY_MAX_ITEMS;
      // Each nested array is itself an element of the outer one, so the outer list counts too.
      return Array.from({ length: full }, () =>
        Array.from({ length: V3_REQUEST_ARRAY_MAX_ITEMS }, () => 0)
      ).concat(rest ? [Array.from({ length: rest }, () => 0)] : []);
    };
    const total = (elements: unknown[][]) => elements.length + elements.reduce((sum, a) => sum + a.length, 0);
    const atLimit = arrays(V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS - 50);
    expect(total(atLimit)).toBe(V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS);

    expect(sniffSurveyImportFile(qsfWith(atLimit)).type).toBe("qsf");
    expectJsonLimit(qsfWith([...atLimit, 0]), "array_elements", "file.SurveyElements");
  });

  test(`takes ${V3_REQUEST_MAX_DEPTH} levels of nesting and refuses one more`, () => {
    // The envelope is the first level; SurveyElements is the outermost of the nested arrays.
    const nested = (levels: number) => `${"[".repeat(levels)}${"]".repeat(levels)}`;
    const qsf = (levels: number) => encode(`{"SurveyEntry":{},"SurveyElements":${nested(levels)}}`);

    expect(sniffSurveyImportFile(qsf(V3_REQUEST_MAX_DEPTH - 1)).type).toBe("qsf");
    const error = refusal(() => sniffSurveyImportFile(qsf(V3_REQUEST_MAX_DEPTH)));
    expect((error as SurveyImportInputError).invalidParams).toEqual([
      expect.objectContaining({ code: "file_limit_exceeded", identifier: "nesting_depth" }),
    ]);
  });
});
