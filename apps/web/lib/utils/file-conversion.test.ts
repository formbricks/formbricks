import { AsyncParser } from "@json2csv/node";
import { describe, expect, test, vi } from "vitest";
import * as xlsx from "xlsx";
import { logger } from "@formbricks/logger";
import { convertToCsv, convertToXlsxBuffer } from "./file-conversion";

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
    const sheet = wb.Sheets["Sheet1"];
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
    const payload = '=HYPERLINK("https://evil.tld","Click")';
    const buffer = convertToXlsxBuffer(["name"], [{ name: payload }]);
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["Sheet1"];
    const cell = sheet["A2"];
    // value stored as plain text, not as a formula (no `f` property)
    expect(cell.f).toBeUndefined();
    expect(cell.v).toBe(`'${payload}`);
  });
});
