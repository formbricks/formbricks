// file-upload.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { StorageAPI } from "@/lib/common/file-upload";
import type { TUploadFileConfig } from "@/types/storage";

// A global fetch mock so we can capture fetch calls.
// Alternatively, use `vi.stubGlobal("fetch", ...)`.
const fetchMock = vi.fn();
global.fetch = fetchMock;

const mockEnvironmentId = "dv46cywjt1fxkkempq7vwued";

describe("StorageAPI", () => {
  const APP_URL = "https://myapp.example";
  const ENV_ID = mockEnvironmentId;

  let storage: StorageAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new StorageAPI(APP_URL, ENV_ID);
  });

  test("throws an error if file object is invalid", async () => {
    // File missing "name", "type", or "base64"
    await expect(storage.uploadFile({ type: "", name: "", base64: "" }, {})).rejects.toThrow(
      "Invalid file object"
    );
  });

  test("throws if first fetch (storage route) returns non-OK", async () => {
    // We provide a valid file object
    const file = { type: "image/png", name: "test.png", base64: "data:image/png;base64,abc" };

    // First fetch returns not ok
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as Response);

    await expect(storage.uploadFile(file)).rejects.toThrow("Upload failed with status: 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${APP_URL}/api/v1/client/${ENV_ID}/storage`,
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  test("throws if second fetch returns non-OK (local storage w/ signingData)", async () => {
    // Suppose the first fetch is OK and returns JSON with signingData
    const file = { type: "image/png", name: "test.png", base64: "data:image/png;base64,abc" };
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });

          return {
            data: {
              signedUrl: "https://myapp.example/uploadLocal",
              fileUrl: "https://myapp.example/files/test.png",
              signingData: { signature: "xxx", timestamp: 1234, uuid: "abc" },
              presignedFields: null,
              updatedFileName: "test.png",
            },
          };
        },
      } as Response)
      // second fetch fails
      .mockResolvedValueOnce({
        ok: false,
        json: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });

          return { message: "File size exceeded your plan limit" };
        },
      } as Response);

    await expect(storage.uploadFile(file)).rejects.toThrow("File size exceeded your plan limit");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("throws if second fetch returns non-OK (S3) containing 'EntityTooLarge'", async () => {
    const file = { type: "image/png", name: "test.png", base64: "data:image/png;base64,abc" };

    // First fetch response includes presignedFields => indicates S3 scenario
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });

          return {
            data: {
              signedUrl: "https://some-s3-bucket/presigned",
              fileUrl: "https://some-s3-bucket/test.png",
              signingData: null, // means not local
              presignedFields: {
                key: "some-key",
                policy: "base64policy",
              },
              updatedFileName: "test.png",
            },
          };
        },
      } as Response)
      // second fetch fails with "EntityTooLarge"
      .mockResolvedValueOnce({
        ok: false,
        text: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });

          return "Some error with EntityTooLarge text in it";
        },
      } as Response);

    await expect(storage.uploadFile(file)).rejects.toThrow("File size exceeds the size limit for your plan");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("successful upload returns fileUrl", async () => {
    const file = { type: "image/png", name: "test.png", base64: "data:image/png;base64,abc" };
    const mockFileUrl = "https://myapp.example/files/test.png";

    // First fetch => OK, returns JSON with 'signedUrl', 'fileUrl', etc.
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });

          return {
            data: {
              signedUrl: "https://myapp.example/uploadLocal",
              fileUrl: mockFileUrl,
              signingData: {
                signature: "xxx",
                timestamp: 1234,
                uuid: "abc",
              },
              presignedFields: null,
              updatedFileName: "test.png",
            },
          };
        },
      } as Response)
      // second fetch => also OK
      .mockResolvedValueOnce({
        ok: true,
      } as Response);

    const url = await storage.uploadFile(file, {
      allowedFileExtensions: [".png", ".jpg"],
      surveyId: "survey_123",
    } as TUploadFileConfig);

    expect(url).toBe(mockFileUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // We can also check the first fetch request body
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall[0]).toBe(`${APP_URL}/api/v1/client/${ENV_ID}/storage`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- we know it's a string
    const bodyPayload = JSON.parse(firstCall[1].body as string);

    expect(bodyPayload).toMatchObject({
      fileName: "test.png",
      fileType: "image/png",
      allowedFileExtensions: [".png", ".jpg"],
      surveyId: "survey_123",
    });
  });
});
