import { describe, expect, test } from "vitest";
import {
  TAttributeStorageColumns,
  prepareAttributeColumnsForStorage,
  prepareNewAttributeForStorage,
  readAttributeValue,
} from "./attribute-storage";

describe("attribute-storage", () => {
  describe("prepareNewAttributeForStorage", () => {
    describe("string values", () => {
      test("should detect plain string and prepare columns", () => {
        const result = prepareNewAttributeForStorage("hello world");

        expect(result.dataType).toBe("string");
        expect(result.columns).toEqual({
          value: "hello world",
          valueNumber: null,
          valueDate: null,
        });
      });

      test("should detect email as string", () => {
        const result = prepareNewAttributeForStorage("test@example.com");

        expect(result.dataType).toBe("string");
        expect(result.columns.value).toBe("test@example.com");
        expect(result.columns.valueNumber).toBeNull();
        expect(result.columns.valueDate).toBeNull();
      });

      test("should handle empty string", () => {
        const result = prepareNewAttributeForStorage("");

        expect(result.dataType).toBe("string");
        expect(result.columns.value).toBe("");
      });
    });

    describe("number values", () => {
      test("should detect integer and prepare columns", () => {
        const result = prepareNewAttributeForStorage(42);

        expect(result.dataType).toBe("number");
        expect(result.columns).toEqual({
          value: "42",
          valueNumber: 42,
          valueDate: null,
        });
      });

      test("should detect float and prepare columns", () => {
        const result = prepareNewAttributeForStorage(3.14159);

        expect(result.dataType).toBe("number");
        expect(result.columns).toEqual({
          value: "3.14159",
          valueNumber: 3.14159,
          valueDate: null,
        });
      });

      test("should detect negative number", () => {
        const result = prepareNewAttributeForStorage(-100);

        expect(result.dataType).toBe("number");
        expect(result.columns.value).toBe("-100");
        expect(result.columns.valueNumber).toBe(-100);
      });

      test("should detect zero", () => {
        const result = prepareNewAttributeForStorage(0);

        expect(result.dataType).toBe("number");
        expect(result.columns.value).toBe("0");
        expect(result.columns.valueNumber).toBe(0);
      });

      test("should detect numeric string and prepare columns", () => {
        const result = prepareNewAttributeForStorage("123");

        expect(result.dataType).toBe("number");
        expect(result.columns).toEqual({
          value: "123",
          valueNumber: 123,
          valueDate: null,
        });
      });

      test("should detect numeric string with decimals", () => {
        const result = prepareNewAttributeForStorage("99.99");

        expect(result.dataType).toBe("number");
        expect(result.columns.valueNumber).toBe(99.99);
      });
    });

    describe("date values", () => {
      test("should detect Date object and prepare columns", () => {
        const date = new Date("2024-06-15T10:30:00.000Z");
        const result = prepareNewAttributeForStorage(date);

        expect(result.dataType).toBe("date");
        expect(result.columns.value).toBe("2024-06-15T10:30:00.000Z");
        expect(result.columns.valueNumber).toBeNull();
        expect(result.columns.valueDate).toEqual(date);
      });

      test("should detect ISO date string and prepare columns", () => {
        const result = prepareNewAttributeForStorage("2024-06-15");

        expect(result.dataType).toBe("date");
        expect(result.columns.valueDate).toBeInstanceOf(Date);
        expect(result.columns.valueNumber).toBeNull();
      });

      test("should detect date string with time", () => {
        const result = prepareNewAttributeForStorage("2024-06-15T14:30:00Z");

        expect(result.dataType).toBe("date");
        expect(result.columns.valueDate).toBeInstanceOf(Date);
      });

      test("should detect date string with slashes", () => {
        const result = prepareNewAttributeForStorage("2024/01/15");

        expect(result.dataType).toBe("date");
        expect(result.columns.valueDate).toBeInstanceOf(Date);
      });
    });
  });

  describe("prepareAttributeColumnsForStorage", () => {
    describe("string dataType", () => {
      test("should handle string input", () => {
        const result = prepareAttributeColumnsForStorage("hello", "string");

        expect(result).toEqual({
          value: "hello",
          valueNumber: null,
          valueDate: null,
        });
      });

      test("should convert number to string", () => {
        const result = prepareAttributeColumnsForStorage(42, "string");

        expect(result).toEqual({
          value: "42",
          valueNumber: null,
          valueDate: null,
        });
      });

      test("should convert Date to ISO string", () => {
        const date = new Date("2024-06-15T10:30:00.000Z");
        const result = prepareAttributeColumnsForStorage(date, "string");

        expect(result).toEqual({
          value: "2024-06-15T10:30:00.000Z",
          valueNumber: null,
          valueDate: null,
        });
      });
    });

    describe("number dataType", () => {
      test("should handle number input", () => {
        const result = prepareAttributeColumnsForStorage(42, "number");

        expect(result).toEqual({
          value: "42",
          valueNumber: 42,
          valueDate: null,
        });
      });

      test("should parse numeric string", () => {
        const result = prepareAttributeColumnsForStorage("123.45", "number");

        expect(result).toEqual({
          value: "123.45",
          valueNumber: 123.45,
          valueDate: null,
        });
      });

      test("should handle string with whitespace", () => {
        const result = prepareAttributeColumnsForStorage("  100  ", "number");

        expect(result.valueNumber).toBe(100);
        expect(result.value).toBe("100");
      });

      test("should gracefully degrade invalid number string to string-only storage", () => {
        const result = prepareAttributeColumnsForStorage("not a number", "number");

        expect(result).toEqual({
          value: "not a number",
          valueNumber: null,
          valueDate: null,
        });
      });

      test("should handle NaN gracefully", () => {
        const result = prepareAttributeColumnsForStorage(NaN, "number");

        expect(result.valueNumber).toBeNull();
      });

      test("should convert Date to timestamp", () => {
        const date = new Date("2024-06-15T10:30:00.000Z");
        const result = prepareAttributeColumnsForStorage(date, "number");

        expect(result.valueNumber).toBe(date.getTime());
      });
    });

    describe("date dataType", () => {
      test("should handle Date input", () => {
        const date = new Date("2024-06-15T10:30:00.000Z");
        const result = prepareAttributeColumnsForStorage(date, "date");

        expect(result).toEqual({
          value: "2024-06-15T10:30:00.000Z",
          valueNumber: null,
          valueDate: date,
        });
      });

      test("should parse ISO date string", () => {
        const result = prepareAttributeColumnsForStorage("2024-06-15", "date");

        expect(result.valueDate).toBeInstanceOf(Date);
        expect(result.valueDate?.getUTCFullYear()).toBe(2024);
        expect(result.valueDate?.getUTCMonth()).toBe(5); // June is 5 (0-indexed)
        expect(result.valueDate?.getUTCDate()).toBe(15);
        expect(result.value).toBe(result.valueDate?.toISOString());
      });

      test("should parse date string with slashes", () => {
        const result = prepareAttributeColumnsForStorage("2024/01/20", "date");

        expect(result.valueDate).toBeInstanceOf(Date);
      });

      test("should parse timestamp number", () => {
        const timestamp = new Date("2024-06-15T10:30:00.000Z").getTime();
        const result = prepareAttributeColumnsForStorage(timestamp, "date");

        expect(result.valueDate).toBeInstanceOf(Date);
        expect(result.valueDate?.getTime()).toBe(timestamp);
      });

      test("should gracefully degrade invalid date string to string-only storage", () => {
        const result = prepareAttributeColumnsForStorage("not a date", "date");

        expect(result).toEqual({
          value: "not a date",
          valueNumber: null,
          valueDate: null,
        });
      });

      test("should handle string with whitespace", () => {
        const result = prepareAttributeColumnsForStorage("  2024-06-15  ", "date");

        expect(result.valueDate).toBeInstanceOf(Date);
      });
    });

    describe("default/unknown dataType", () => {
      test("should fallback to string storage for unknown type", () => {
        const result = prepareAttributeColumnsForStorage("test", "unknown" as "string");

        expect(result).toEqual({
          value: "test",
          valueNumber: null,
          valueDate: null,
        });
      });
    });
  });

  describe("readAttributeValue", () => {
    describe("string dataType", () => {
      test("should return value column", () => {
        const attribute: TAttributeStorageColumns = {
          value: "hello world",
          valueNumber: null,
          valueDate: null,
        };

        const result = readAttributeValue(attribute, "string");

        expect(result).toBe("hello world");
      });

      test("should return value even if other columns are populated", () => {
        const attribute: TAttributeStorageColumns = {
          value: "test",
          valueNumber: 123,
          valueDate: new Date(),
        };

        const result = readAttributeValue(attribute, "string");

        expect(result).toBe("test");
      });
    });

    describe("number dataType", () => {
      test("should return valueNumber as string when available", () => {
        const attribute: TAttributeStorageColumns = {
          value: "42",
          valueNumber: 42,
          valueDate: null,
        };

        const result = readAttributeValue(attribute, "number");

        expect(result).toBe("42");
      });

      test("should return value as fallback when valueNumber is null", () => {
        const attribute: TAttributeStorageColumns = {
          value: "not a number",
          valueNumber: null,
          valueDate: null,
        };

        const result = readAttributeValue(attribute, "number");

        expect(result).toBe("not a number");
      });

      test("should handle zero correctly", () => {
        const attribute: TAttributeStorageColumns = {
          value: "0",
          valueNumber: 0,
          valueDate: null,
        };

        const result = readAttributeValue(attribute, "number");

        expect(result).toBe("0");
      });

      test("should handle negative numbers", () => {
        const attribute: TAttributeStorageColumns = {
          value: "-50",
          valueNumber: -50,
          valueDate: null,
        };

        const result = readAttributeValue(attribute, "number");

        expect(result).toBe("-50");
      });

      test("should handle float precision", () => {
        const attribute: TAttributeStorageColumns = {
          value: "3.14159",
          valueNumber: 3.14159,
          valueDate: null,
        };

        const result = readAttributeValue(attribute, "number");

        expect(result).toBe("3.14159");
      });
    });

    describe("date dataType", () => {
      test("should return valueDate as ISO string when available", () => {
        const date = new Date("2024-06-15T10:30:00.000Z");
        const attribute: TAttributeStorageColumns = {
          value: "2024-06-15T10:30:00.000Z",
          valueNumber: null,
          valueDate: date,
        };

        const result = readAttributeValue(attribute, "date");

        expect(result).toBe("2024-06-15T10:30:00.000Z");
      });

      test("should return value as fallback when valueDate is null", () => {
        const attribute: TAttributeStorageColumns = {
          value: "invalid date stored",
          valueNumber: null,
          valueDate: null,
        };

        const result = readAttributeValue(attribute, "date");

        expect(result).toBe("invalid date stored");
      });
    });

    describe("default/unknown dataType", () => {
      test("should return value column for unknown type", () => {
        const attribute: TAttributeStorageColumns = {
          value: "fallback",
          valueNumber: 123,
          valueDate: new Date(),
        };

        const result = readAttributeValue(attribute, "unknown" as "string");

        expect(result).toBe("fallback");
      });
    });
  });

  describe("integration scenarios", () => {
    test("round-trip: prepare and read string value", () => {
      const originalValue = "hello world";
      const { dataType, columns } = prepareNewAttributeForStorage(originalValue);
      const readValue = readAttributeValue(columns, dataType);

      expect(readValue).toBe(originalValue);
    });

    test("round-trip: prepare and read number value", () => {
      const originalValue = 42.5;
      const { dataType, columns } = prepareNewAttributeForStorage(originalValue);
      const readValue = readAttributeValue(columns, dataType);

      expect(readValue).toBe("42.5");
      expect(Number(readValue)).toBe(originalValue);
    });

    test("round-trip: prepare and read date value", () => {
      const originalDate = new Date("2024-06-15T10:30:00.000Z");
      const { dataType, columns } = prepareNewAttributeForStorage(originalDate);
      const readValue = readAttributeValue(columns, dataType);

      expect(readValue).toBe(originalDate.toISOString());
      expect(new Date(readValue).getTime()).toBe(originalDate.getTime());
    });

    test("round-trip: prepare and read numeric string", () => {
      const originalValue = "123";
      const { dataType, columns } = prepareNewAttributeForStorage(originalValue);
      const readValue = readAttributeValue(columns, dataType);

      expect(dataType).toBe("number");
      expect(readValue).toBe("123");
    });

    test("round-trip: prepare and read date string", () => {
      const originalValue = "2024-06-15";
      const { dataType, columns } = prepareNewAttributeForStorage(originalValue);
      const readValue = readAttributeValue(columns, dataType);

      expect(dataType).toBe("date");
      expect(columns.valueDate).toBeInstanceOf(Date);
      expect(readValue).toBe(columns.valueDate?.toISOString());
    });

    test("graceful degradation: invalid number string maintains original value", () => {
      const originalValue = "abc123";
      const columns = prepareAttributeColumnsForStorage(originalValue, "number");
      const readValue = readAttributeValue(columns, "number");

      expect(readValue).toBe("abc123");
    });

    test("graceful degradation: invalid date string maintains original value", () => {
      const originalValue = "not-a-date";
      const columns = prepareAttributeColumnsForStorage(originalValue, "date");
      const readValue = readAttributeValue(columns, "date");

      expect(readValue).toBe("not-a-date");
    });
  });
});
