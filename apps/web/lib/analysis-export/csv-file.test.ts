import { describe, expect, test } from "vitest";
import { CSV_BOM, analysisCsvLine } from "./csv-file";

describe("analysisCsvLine", () => {
  test("quotes text, writes numbers bare, leaves null empty and ends with CRLF", () => {
    expect(analysisCsvLine(["resp_1", 9, null, "01"])).toBe('"resp_1",9,,"01"\r\n');
  });

  test("doubles inner quotes and keeps commas inside the quotes", () => {
    expect(analysisCsvLine(['He said "hi", twice'])).toBe('"He said ""hi"", twice"\r\n');
  });

  test("turns every kind of line break inside a cell into one space, SPSS cannot read them", () => {
    expect(analysisCsvLine(["a\r\nb", "c\nd", "e\rf", "g\u2028h"])).toBe('"a b","c d","e f","g h"\r\n');
  });

  test("keeps Arabic text as written", () => {
    expect(analysisCsvLine(["أحمر"])).toBe('"أحمر"\r\n');
  });

  test("defangs a text cell that starts like a formula and leaves numbers untouched", () => {
    expect(analysisCsvLine(["=SUM(A1)", "+1", "-2", "@x", -3])).toBe(`"'=SUM(A1)","'+1","'-2","'@x",-3\r\n`);
  });

  test("the byte order mark is the UTF-8 one, so Excel reads Arabic", () => {
    expect(Buffer.from(CSV_BOM, "utf8")).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });
});
