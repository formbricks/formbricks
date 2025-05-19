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
});
