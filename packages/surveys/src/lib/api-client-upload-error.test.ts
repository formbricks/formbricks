import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client";

describe("ApiClient uploadFile base64 decode error", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({
      appUrl: "http://localhost:3000",
      environmentId: "env-test",
    });
    global.fetch = vi.fn();
  });

  it('throws "Error uploading file" if base64 is invalid', async () => {
    // Mock the initial "signing" fetch to succeed
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          // Presigned fields present
          presignedFields: { policy: "testPolicy" },
          signedUrl: "https://fake-s3-url.com",
          fileUrl: "https://fake-file-url.com",
          signingData: null,
          updatedFileName: "test.jpg",
        },
      }),
    } as unknown as Response);

    // Provide an invalid base64 so that atob throws
    const invalidBase64 = "data:image/jpeg;base64,####";
    await expect(() =>
      client.uploadFile({
        base64: invalidBase64,
        name: "test.jpg",
        type: "image/jpeg",
      })
    ).rejects.toThrow("Error uploading file");
  });
});
