import { describe, expect, test } from "vitest";
import { constructGoogleSheetsUrl, extractSpreadsheetIdFromUrl, isValidGoogleSheetsUrl } from "./util";

describe("Google Sheets Util", () => {
  describe("extractSpreadsheetIdFromUrl", () => {
    test("should extract spreadsheet ID from a valid URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPq/edit#gid=0";
      const expectedId = "1aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPq";
      expect(extractSpreadsheetIdFromUrl(url)).toBe(expectedId);
    });

    test("should throw an error for an invalid URL", () => {
      const invalidUrl = "https://not-a-google-sheet-url.com";
      expect(() => extractSpreadsheetIdFromUrl(invalidUrl)).toThrow("Invalid Google Sheets URL");
    });

    test("should throw an error for a URL without an ID", () => {
      const urlWithoutId = "https://docs.google.com/spreadsheets/d/";
      expect(() => extractSpreadsheetIdFromUrl(urlWithoutId)).toThrow("Invalid Google Sheets URL");
    });
  });

  describe("constructGoogleSheetsUrl", () => {
    test("should construct a valid Google Sheets URL from a spreadsheet ID", () => {
      const spreadsheetId = "1aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPq";
      const expectedUrl =
        "https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPq";
      expect(constructGoogleSheetsUrl(spreadsheetId)).toBe(expectedUrl);
    });
  });

  describe("isValidGoogleSheetsUrl", () => {
    test("should return true for a valid Google Sheets URL", () => {
      const validUrl =
        "https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPq/edit#gid=0";
      expect(isValidGoogleSheetsUrl(validUrl)).toBe(true);
    });

    test("should return false for an invalid URL", () => {
      const invalidUrl = "https://not-a-google-sheet-url.com";
      expect(isValidGoogleSheetsUrl(invalidUrl)).toBe(false);
    });

    test("should return true for a base Google Sheets URL", () => {
      const baseUrl = "https://docs.google.com/spreadsheets/d/";
      expect(isValidGoogleSheetsUrl(baseUrl)).toBe(true);
    });
  });
});
