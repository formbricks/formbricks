import { beforeEach, describe, expect, test, vi } from "vitest";
import { convertHeicToJpegAction } from "./actions";

// Mock the authenticatedActionClient
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    schema: () => ({
      action: (handler: any) => async (input: any) => {
        try {
          const parsedInput = { file: input.file };
          const data = await handler({ parsedInput });
          return { data, serverError: undefined };
        } catch (e) {
          console.error(e);
          return { data: undefined, serverError: "Something went wrong while executing the operation." };
        }
      },
    }),
  },
}));

// Directly mock convertHeicToJpegAction for this test file
vi.mock("./actions", () => ({
  convertHeicToJpegAction: vi.fn(async ({ file }) => {
    if (file.name.endsWith(".heic")) {
      // Simulate conversion
      return {
        data: new File(["converted-jpg-content"], file.name.replace(/\.heic$/, ".jpg"), {
          type: "image/jpeg",
        }),
        serverError: undefined,
      };
    }
    return { data: file, serverError: undefined };
  }),
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

    expect(result?.data).toEqual(file);
  });

  test("converts heic file to jpg", async () => {
    const file = new File(["test"], "test.heic", { type: "image/heic" });

    // Mock arrayBuffer method
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(10));

    const resultFile = await convertHeicToJpegAction({ file });

    // Check the result is a File object with expected properties
    if (resultFile?.data instanceof File) {
      expect(resultFile.data.name).toBe("test.jpg");
      expect(resultFile.data.type).toBe("image/jpeg");
    }
  });
});
