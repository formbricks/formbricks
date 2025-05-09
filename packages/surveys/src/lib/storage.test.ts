import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOriginalFileNameFromUrl } from "./storage";

describe("getOriginalFileNameFromUrl", () => {
  let consoleErrorSpy: any; // Explicitly 'any' to avoid type issues for now

  beforeEach(() => {
    // Spy on console.error before each test
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after each test
    consoleErrorSpy.mockRestore();
  });

  // Test cases for URLs with --fid--
  describe("with --fid-- separator", () => {
    it("should extract original name from /storage/ path with extension", () => {
      const url = "/storage/My%20Document--fid--123xyz.pdf";
      expect(getOriginalFileNameFromUrl(url)).toBe("My Document.pdf");
    });

    it("should extract original name from full URL with extension", () => {
      const url = "https://example.com/files/Another%20File--fid--abc456.docx";
      expect(getOriginalFileNameFromUrl(url)).toBe("Another File.docx");
    });

    it("should handle filenames with dots before --fid--", () => {
      const url = "/storage/archive.version1--fid--qwerty.tar.gz";
      expect(getOriginalFileNameFromUrl(url)).toBe("archive.version1.gz");
    });

    it("should handle missing original filename part", () => {
      const url = "/storage/--fid--789.txt";
      expect(getOriginalFileNameFromUrl(url)).toBe("");
    });

    it("should handle if fileId part is empty but has an extension", () => {
      const url = "/storage/report-data--fid--.csv";
      expect(getOriginalFileNameFromUrl(url)).toBe("report-data.csv");
    });

    it("should handle if there is no extension after fileId", () => {
      const url = "/storage/image_file--fid--uniqueid";
      expect(getOriginalFileNameFromUrl(url)).toBe("image_file.image_file--fid--uniqueid");
    });

    it("should handle filename ending with a dot after --fid--", () => {
      const url = "/storage/reportData--fid--version2.";
      expect(getOriginalFileNameFromUrl(url)).toBe("reportData.");
    });

    it("should handle complex encoded originalFileName with an extension", () => {
      const url = "/storage/File%20With%20%25%20Percent--fid--idWith.dot.ext";
      expect(getOriginalFileNameFromUrl(url)).toBe("File With % Percent.ext");
    });
  });

  // Test cases for URLs without --fid--
  describe("without --fid-- separator", () => {
    it("should return decoded name from /storage/ path", () => {
      const url = "/storage/My%20CV.pdf";
      expect(getOriginalFileNameFromUrl(url)).toBe("My CV.pdf");
    });

    it("should return decoded name from full URL", () => {
      const url = "https://cdn.example.com/assets/Company%20Logo.png";
      expect(getOriginalFileNameFromUrl(url)).toBe("Company Logo.png");
    });

    it("should handle filenames without extension", () => {
      const url = "/storage/report_final";
      expect(getOriginalFileNameFromUrl(url)).toBe("report_final");
    });

    it("should handle filenames starting with a dot", () => {
      const url = "https://example.com/configs/.env_prod";
      expect(getOriginalFileNameFromUrl(url)).toBe(".env_prod");
    });

    it("should handle filename ending with a dot (no --fid--)", () => {
      const url = "/storage/finalReport.";
      expect(getOriginalFileNameFromUrl(url)).toBe("finalReport.");
    });

    it("should handle complex encoded name with extension-like part", () => {
      const url = "/storage/Another%20Complex%20Name%26Symbols.part1";
      expect(getOriginalFileNameFromUrl(url)).toBe("Another Complex Name&Symbols.part1");
    });
  });

  // Edge cases and error handling
  describe("edge cases and error handling", () => {
    it("should return empty string for an empty URL", () => {
      expect(getOriginalFileNameFromUrl("")).toBe("");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should return empty string for an invalid URL and log error", () => {
      const url = "this is not a url";
      expect(getOriginalFileNameFromUrl(url)).toBe("");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should return empty string if URL ends with a slash", () => {
      const url = "https://example.com/files/path/";
      expect(getOriginalFileNameFromUrl(url)).toBe("");
      // Depending on URL parsing, this might or might not log an error.
      // Current function logic for this specific case (ending with /) might not throw inside new URL(),
      // but .pop() on split by / might yield empty string, thus no error logged from catch.
    });

    it("should handle URL with query parameters and fragment", () => {
      const url = "https://example.com/files/document.pdf?version=2#page10";
      expect(getOriginalFileNameFromUrl(url)).toBe("document.pdf");
    });
  });
});
