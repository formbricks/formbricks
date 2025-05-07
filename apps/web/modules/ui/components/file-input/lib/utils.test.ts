import { toast } from "react-hot-toast";
import { beforeEach, describe, expect, test, vi } from "vitest";
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
  });
});
