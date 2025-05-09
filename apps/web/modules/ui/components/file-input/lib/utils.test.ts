import { toast } from "react-hot-toast";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { convertHeicToJpegAction } from "./actions";
import { checkForYoutubePrivacyMode, getAllowedFiles } from "./utils";

// Mock FileReader
class MockFileReader {
  onload: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  result: string | null = null;

  readAsDataURL() {
    // Simulate asynchronous read
    setTimeout(() => {
      this.result = "data:text/plain;base64,dGVzdA=="; // base64 for "test"
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
}

// Mock global FileReader
global.FileReader = MockFileReader as any;

// Mock dependencies
vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("./actions", () => ({
  convertHeicToJpegAction: vi.fn(),
}));

describe("File Input Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllowedFiles", () => {
    test("should filter out files with unsupported extensions", async () => {
      const files = [
        new File(["test"], "test.txt", { type: "text/plain" }),
        new File(["test"], "test.doc", { type: "application/msword" }),
      ];

      const result = await getAllowedFiles(files, ["txt"], 5);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test.txt");
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Unsupported file types: test.doc"));
    });

    test("should filter out files exceeding size limit", async () => {
      const files = [
        new File(["x".repeat(6 * 1024 * 1024)], "large.txt", { type: "text/plain" }),
        new File(["test"], "small.txt", { type: "text/plain" }),
      ];

      const result = await getAllowedFiles(files, ["txt"], 5);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("small.txt");
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Files exceeding size limit (5 MB)"));
    });

    test("should convert HEIC files to JPEG", async () => {
      const heicFile = new File(["test"], "test.heic", { type: "image/heic" });
      const mockConvertedFile = new File(["converted"], "test.jpg", { type: "image/jpeg" });

      vi.mocked(convertHeicToJpegAction).mockResolvedValue({
        data: mockConvertedFile,
      });

      const result = await getAllowedFiles([heicFile], ["heic", "jpg"], 5);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test.jpg");
      expect(result[0].type).toBe("image/jpeg");
    });

    test("returns empty array when no files are provided", async () => {
      const result = await getAllowedFiles([], ["jpg"] as TAllowedFileExtension[]);
      expect(result).toEqual([]);
    });

    test("returns only allowed files based on extensions", async () => {
      const jpgFile = new File(["jpg content"], "test.jpg", { type: "image/jpeg" });
      const pdfFile = new File(["pdf content"], "test.pdf", { type: "application/pdf" });
      const txtFile = new File(["txt content"], "test.txt", { type: "text/plain" });

      const allowedExtensions = ["jpg", "pdf"] as TAllowedFileExtension[];
      const filesToFilter = [jpgFile, pdfFile, txtFile];

      const result = await getAllowedFiles(filesToFilter, allowedExtensions);

      expect(result).toHaveLength(2);
      expect(result.map((file) => file.name)).toContain("test.jpg");
      expect(result.map((file) => file.name)).toContain("test.pdf");
      expect(result.map((file) => file.name)).not.toContain("test.txt");
    });

    test("handles files without extensions", async () => {
      const noExtensionFile = new File(["content"], "testfile", { type: "application/octet-stream" });

      const result = await getAllowedFiles([noExtensionFile], ["jpg"] as TAllowedFileExtension[]);
      expect(result).toHaveLength(0);
    });
  });

  describe("checkForYoutubePrivacyMode", () => {
    test("should return true for youtube-nocookie.com URLs", () => {
      const url = "https://www.youtube-nocookie.com/watch?v=test";
      expect(checkForYoutubePrivacyMode(url)).toBe(true);
    });

    test("should return false for regular youtube.com URLs", () => {
      const url = "https://www.youtube.com/watch?v=test";
      expect(checkForYoutubePrivacyMode(url)).toBe(false);
    });

    test("should return false for invalid URLs", () => {
      const url = "not-a-url";
      expect(checkForYoutubePrivacyMode(url)).toBe(false);
    });

    test("returns true for youtube-nocookie.com URLs", () => {
      expect(checkForYoutubePrivacyMode("https://www.youtube-nocookie.com/embed/123")).toBe(true);
    });

    test("returns false for regular youtube.com URLs", () => {
      expect(checkForYoutubePrivacyMode("https://www.youtube.com/watch?v=123")).toBe(false);
    });

    test("returns false for non-YouTube URLs", () => {
      expect(checkForYoutubePrivacyMode("https://www.example.com")).toBe(false);
    });
  });
});
