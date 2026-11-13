import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import { jsonResponse } from "@/modules/api/lib/hook-test-utils";
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

const CONVERSION_URL = "/api/internal/heic-conversions";
const JPEG_BYTES = new TextEncoder().encode("converted jpeg");

/** The conversion route answering with a JPEG of `bytes`, or with a problem response. */
const answerConversion = (response: Response) => vi.mocked(fetch).mockResolvedValue(response);
const convertedJpeg = (bytes: Uint8Array = JPEG_BYTES) =>
  jsonResponse({ data: { image: Buffer.from(bytes).toString("base64"), contentType: "image/jpeg" } });

describe("File Input Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Unsupported file type."));
    });

    test("should filter out files exceeding size limit", async () => {
      const files = [
        new File(["x".repeat(6 * 1024 * 1024)], "large.txt", { type: "text/plain" }),
        new File(["test"], "small.txt", { type: "text/plain" }),
      ];

      const result = await getAllowedFiles(files, ["txt"], 5);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("small.txt");
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("File exceeds 5 MB size limit."));
    });

    test("should show size error for oversized files even when mime type is empty", async () => {
      const files = [new File(["x".repeat(101000)], "large.ico", { type: "" })];

      const result = await getAllowedFiles(files, ["ico"], 0.1);

      expect(result).toHaveLength(0);
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("File exceeds 0.1 MB size limit."));
    });

    test("should convert HEIC files to JPEG on the server", async () => {
      const heicFile = new File(["test"], "test.heic", { type: "image/heic" });
      answerConversion(convertedJpeg());

      const result = await getAllowedFiles([heicFile], ["heic", "jpg"], 5);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test.jpg");
      expect(result[0].type).toBe("image/jpeg");
      expect(new Uint8Array(await result[0].arrayBuffer())).toEqual(JPEG_BYTES);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(CONVERSION_URL);
      expect(init?.method).toBe("POST");
      // The photo goes up base64-encoded, without its data-URL prefix ("test" is "dGVzdA==").
      expect(JSON.parse(String(init?.body))).toEqual({ image: "dGVzdA==" });
    });

    test("names a converted upper-case .HEIC file .jpg", async () => {
      answerConversion(convertedJpeg());

      const [converted] = await getAllowedFiles([new File(["test"], "IMG_0001.HEIC")], ["heic"], 5);

      expect(converted.name).toBe("IMG_0001.jpg");
    });

    test("lists a HEIC file the server can't convert as unsupported", async () => {
      answerConversion(jsonResponse({ status: 422, detail: "The image is not a HEIC image." }, 422));

      const result = await getAllowedFiles([new File(["test"], "broken.heic")], ["heic", "jpg"], 5);

      expect(result).toEqual([]);
      expect(toast.error).toHaveBeenCalledWith("Unsupported file type.");
    });

    test("refuses a HEIC file whose JPEG is over the size limit", async () => {
      answerConversion(convertedJpeg(new Uint8Array(200_000)));

      const result = await getAllowedFiles([new File(["test"], "large.heic")], ["heic", "jpg"], 0.1);

      expect(result).toEqual([]);
      expect(toast.error).toHaveBeenCalledWith("File exceeds 0.1 MB size limit.");
    });

    test("never sends a file that is not HEIC to the server", async () => {
      await getAllowedFiles([new File(["test"], "photo.jpg", { type: "image/jpeg" })], ["jpg"], 5);
      expect(fetch).not.toHaveBeenCalled();
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

    test("should return false for empty or whitespace-only string", () => {
      expect(checkForYoutubePrivacyMode("")).toBe(false);
      expect(checkForYoutubePrivacyMode("   ")).toBe(false);
    });

    test("should return false for non-string types", () => {
      expect(checkForYoutubePrivacyMode(null as any)).toBe(false);
      expect(checkForYoutubePrivacyMode(123 as any)).toBe(false);
    });
  });
});
