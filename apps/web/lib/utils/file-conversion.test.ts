import { AsyncParser } from "@json2csv/node";
import { describe, expect, test, vi } from "vitest";
import * as xlsx from "xlsx";
import { logger } from "@formbricks/logger";
import {
  XLSX_MAX_CELL_LENGTH,
  XLSX_TRUNCATION_MARKER,
  convertToCsv,
  convertToXlsxBuffer,
  toCsvLine,
  truncateForXlsxCell,
} from "./file-conversion";

// Mock the logger to capture error calls
vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("convertToCsv", () => {
  const fields = ["name", "age"];
  const data = [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ];

  test("should convert JSON array to CSV string with header", async () => {
    const csv = await convertToCsv(fields, data);
    const lines = csv.trim().split("\n");
    // json2csv quotes headers by default
    expect(lines[0]).toBe('"name","age"');
    expect(lines[1]).toBe('"Alice",30');
    expect(lines[2]).toBe('"Bob",25');
  });

  test("should keep text over the Excel cell limit in full", async () => {
    const long = "a".repeat(XLSX_MAX_CELL_LENGTH + 500);
    const csv = await convertToCsv(["answer"], [{ answer: long }]);
    expect(csv.trim().split("\n")[1]).toBe(`"${long}"`);
  });

  test("should log an error and throw when conversion fails", async () => {
    const parseSpy = vi.spyOn(AsyncParser.prototype, "parse").mockImplementation(
      () =>
        ({
          promise: () => Promise.reject(new Error("Test parse error")),
        }) as any
    );

    await expect(convertToCsv(fields, data)).rejects.toThrow("Failed to convert to CSV");
    expect(logger.error).toHaveBeenCalledWith(expect.any(Error), "Failed to convert to CSV");

    parseSpy.mockRestore();
  });

  test("should defang formula injection payloads in cell values", async () => {
    const payloads = [
      '=HYPERLINK("https://evil.tld","Click")',
      "+1+1",
      "-2+3",
      "@SUM(A1:A2)",
      "\tleading-tab",
      "\rleading-cr",
    ];
    const rows = payloads.map((p) => ({ name: p, age: 0 }));
    const csv = await convertToCsv(["name", "age"], rows);
    const lines = csv.trim().split("\n").slice(1); // drop header
    payloads.forEach((p, i) => {
      // each value should be prefixed with a single quote so the spreadsheet
      // app treats it as text rather than a formula
      expect(lines[i].startsWith(`"'${p.charAt(0)}`)).toBe(true);
    });
  });

  test("should defang formula injection in field/header names", async () => {
    const csv = await convertToCsv(["=evil", "age"], [{ "=evil": "x", age: 1 }]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe('"\'=evil","age"');
    expect(lines[1]).toBe('"x",1');
  });

  test("should not alter benign strings", async () => {
    const csv = await convertToCsv(["name"], [{ name: "Alice = Bob" }]);
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe('"Alice = Bob"');
  });

  test("should preserve distinct columns whose labels collide after sanitization", async () => {
    // "=field" and "'=field" both render as "'=field" once defanged, but the
    // underlying row keys must stay distinct so neither cell is dropped.
    const csv = await convertToCsv(["=field", "'=field"], [{ "=field": "a", "'=field": "b" }]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe('"\'=field","\'=field"');
    expect(lines[1]).toBe('"a","b"');
  });
});

describe("convertToXlsxBuffer", () => {
  const fields = ["name", "age"];
  const data = [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ];

  test("should convert JSON array to XLSX buffer and preserve data", () => {
    const buffer = convertToXlsxBuffer(fields, data);
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["Response Data"];
    // Skip header row (range:1) and remove internal row metadata
    const raw = xlsx.utils.sheet_to_json<Record<string, string | number>>(sheet, {
      header: fields,
      defval: "",
      range: 1,
    });
    const cleaned = raw.map(({ __rowNum__, ...rest }) => rest);
    expect(cleaned).toEqual(data);
  });

  test("should defang formula injection payloads in xlsx cells", () => {
    const payloads = [
      '=HYPERLINK("https://evil.tld","Click")',
      "+1+1",
      "-2+3",
      "@SUM(A1:A2)",
      "\tleading-tab",
      "\rleading-cr",
    ];
    const rows = payloads.map((p) => ({ name: p }));
    const buffer = convertToXlsxBuffer(["name"], rows);
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["Response Data"];
    payloads.forEach((p, i) => {
      const cell = sheet[`A${i + 2}`]; // row 1 is header
      // value stored as plain text, not as a formula (no `f` property)
      expect(cell.f).toBeUndefined();
      expect(cell.v).toBe(`'${p}`);
    });
  });

  test("should defang formula injection in xlsx header names", () => {
    const buffer = convertToXlsxBuffer(["=evil", "name"], [{ "=evil": "x", name: "Alice" }]);
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["Response Data"];
    const headerCell = sheet["A1"];
    expect(headerCell.f).toBeUndefined();
    expect(headerCell.v).toBe("'=evil");
    // benign header untouched
    expect(sheet["B1"].v).toBe("name");
    // data row mapped via original key
    expect(sheet["A2"].v).toBe("x");
    expect(sheet["B2"].v).toBe("Alice");
  });

  test("should preserve distinct xlsx columns whose labels collide after sanitization", () => {
    // Original keys "=field" and "'=field" both render as "'=field"; ensure
    // both cells survive instead of one overwriting the other.
    const buffer = convertToXlsxBuffer(["=field", "'=field"], [{ "=field": "a", "'=field": "b" }]);
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["Response Data"];
    expect(sheet["A1"].v).toBe("'=field");
    expect(sheet["B1"].v).toBe("'=field");
    expect(sheet["A2"].v).toBe("a");
    expect(sheet["B2"].v).toBe("b");
  });

  describe("Excel cell length limit", () => {
    const readSheet = (buffer: Buffer) => xlsx.read(buffer, { type: "buffer" }).Sheets["Response Data"];

    test("should export a value over the limit, truncated with a visible marker", () => {
      const long = "a".repeat(XLSX_MAX_CELL_LENGTH + 500);
      const sheet = readSheet(convertToXlsxBuffer(["answer", "age"], [{ answer: long, age: 30 }]));
      const value = sheet["A2"].v as string;
      expect(value).toHaveLength(XLSX_MAX_CELL_LENGTH);
      expect(value.endsWith(XLSX_TRUNCATION_MARKER)).toBe(true);
      expect(value.startsWith("aaa")).toBe(true);
      // other cells are untouched
      expect(sheet["B2"].v).toBe(30);
    });

    test("should export a header over the limit, truncated with a visible marker", () => {
      const longHeader = "Q".repeat(XLSX_MAX_CELL_LENGTH + 1);
      const sheet = readSheet(convertToXlsxBuffer([longHeader], [{ [longHeader]: "answer" }]));
      const header = sheet["A1"].v as string;
      expect(header).toHaveLength(XLSX_MAX_CELL_LENGTH);
      expect(header.endsWith(XLSX_TRUNCATION_MARKER)).toBe(true);
      // the row is still looked up by the original, untruncated key
      expect(sheet["A2"].v).toBe("answer");
    });

    test("should leave a value of exactly the limit unchanged", () => {
      const exact = "b".repeat(XLSX_MAX_CELL_LENGTH);
      const sheet = readSheet(convertToXlsxBuffer(["answer"], [{ answer: exact }]));
      expect(sheet["A2"].v).toBe(exact);
    });

    test("should keep the formula-safety prefix when it pushes a value at the limit over it", () => {
      const payload = "=" + "c".repeat(XLSX_MAX_CELL_LENGTH - 1);
      const sheet = readSheet(convertToXlsxBuffer(["answer"], [{ answer: payload }]));
      const value = sheet["A2"].v as string;
      expect(sheet["A2"].f).toBeUndefined();
      expect(value).toHaveLength(XLSX_MAX_CELL_LENGTH);
      expect(value.startsWith("'=")).toBe(true);
      expect(value.endsWith(XLSX_TRUNCATION_MARKER)).toBe(true);
    });
  });
});

describe("truncateForXlsxCell", () => {
  test("should not split a surrogate pair at the cut", () => {
    const keep = XLSX_MAX_CELL_LENGTH - XLSX_TRUNCATION_MARKER.length;
    // Place an emoji so its high surrogate is the last kept code unit.
    const value = "d".repeat(keep - 1) + "😀" + "e".repeat(100);
    const result = truncateForXlsxCell(value);
    expect(result).toBe("d".repeat(keep - 1) + XLSX_TRUNCATION_MARKER);
    expect(result.length).toBeLessThanOrEqual(XLSX_MAX_CELL_LENGTH);
  });

  test("should keep a surrogate pair that ends exactly at the cut", () => {
    const keep = XLSX_MAX_CELL_LENGTH - XLSX_TRUNCATION_MARKER.length;
    const value = "d".repeat(keep - 2) + "😀" + "e".repeat(100);
    expect(truncateForXlsxCell(value)).toBe("d".repeat(keep - 2) + "😀" + XLSX_TRUNCATION_MARKER);
  });

  test("should pass numbers and short strings through unchanged", () => {
    expect(truncateForXlsxCell(42)).toBe(42);
    expect(truncateForXlsxCell("short")).toBe("short");
    expect(truncateForXlsxCell(undefined)).toBeUndefined();
  });
});

describe("toCsvLine", () => {
  test("quotes strings, leaves numbers bare, and ends with CRLF", () => {
    expect(toCsvLine(["run_1", 42, "surveys"])).toBe('"run_1",42,"surveys"\r\n');
  });

  test("doubles quotes inside a string so commas and quotes can't break the row", () => {
    expect(toCsvLine(['He said "hi", then left'])).toBe('"He said ""hi"", then left"\r\n');
  });

  test("writes null and undefined as empty cells", () => {
    expect(toCsvLine(["a", null, undefined, "b"])).toBe('"a",,,"b"\r\n');
  });

  test.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tlead", "\rlead"])(
    "defangs %j so a spreadsheet won't run it as a formula",
    (value) => {
      expect(toCsvLine([value])).toBe(`"'${value}"\r\n`);
    }
  );

  test("keeps a newline inside a quoted cell", () => {
    expect(toCsvLine(["line one\nline two"])).toBe('"line one\nline two"\r\n');
  });
});
