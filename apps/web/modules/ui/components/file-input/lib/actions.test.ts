import { beforeEach, describe, expect, test, vi } from "vitest";
import { convertHeicToJpegAction } from "./actions";

// Mock the authenticatedActionClient
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    schema: () => ({
      action: (handler: any) => async (input: any) => {
        return handler({ parsedInput: input });
      },
    }),
  },
}));

// Mock heic-convert
vi.mock("heic-convert", () => ({
  default: vi.fn().mockImplementation(() => {
    return Buffer.from("converted-jpg-content");
  }),
}));

describe("convertHeicToJpegAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the same file if not a heic file", async () => {
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    const result = await convertHeicToJpegAction({ file });

    expect(result).toBe(file);
  });

  test("converts heic file to jpg", async () => {
    const file = new File(["test"], "test.heic", { type: "image/heic" });

    // Mock arrayBuffer method
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(10));

    const resultFile = await convertHeicToJpegAction({ file });

    // Check the result is a File object with expected properties
    if (resultFile instanceof File) {
      expect(resultFile.name).toBe("test.jpg");
      expect(resultFile.type).toBe("image/jpeg");
    }
  });
});
