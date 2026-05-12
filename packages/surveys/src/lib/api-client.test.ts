import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FILE_UPLOAD_ERROR_NAMES } from "@formbricks/types/errors";
import { STORAGE_ERROR_CODES } from "@formbricks/types/storage";
import { ApiClient } from "./api-client";

describe("ApiClient", () => {
  const appUrl = "http://localhost:3000";
  const environmentId = "env-test";
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({ appUrl, environmentId });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createDisplay", () => {
    test("creates a display successfully (v2) and returns the result", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { id: "display123" } }),
      } as unknown as Response);
      const result = await client.createDisplay({
        displayId: "abc",
        userId: undefined, // ensures we use v2
      } as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe("display123");
      }
      const requestPath = vi.mocked(global.fetch).mock.calls[0][0];
      expect(requestPath).toContain("/api/v2/");
    });

    test("returns an error if fetch fails", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ code: "internal_server_error" }),
      } as unknown as Response);
      const result = await client.createDisplay({ displayId: "xyz" } as any);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("network_error");
      }
    });
  });

  describe("createResponse", () => {
    test("creates a response (v2) and returns success", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { id: "response123" } }),
      } as unknown as Response);
      const result = await client.createResponse({
        contactId: "contact123",
        userId: undefined,
      } as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toEqual("response123");
      }
      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain("/api/v2/");
    });

    test("creates a response (v1) if userId is present", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { id: "v1response" } }),
      } as unknown as Response);
      const result = await client.createResponse({
        userId: "test",
        contactId: null,
      } as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toEqual("v1response");
      }
      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain("/api/v1/");
    });

    test("handles create response fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: "internal_server_error" }),
      } as unknown as Response);
      const result = await client.createResponse({} as any);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("network_error");
      }
    });
  });

  describe("getResponseIdByDisplayId", () => {
    test("gets a linked responseId for a display", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { responseId: "response123" } }),
      } as unknown as Response);

      const result = await client.getResponseIdByDisplayId("display123");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.responseId).toBe("response123");
      }
      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain(
        "/api/v1/client/env-test/displays/display123/response"
      );
    });

    test("returns an error if the display lookup fails", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ code: "not_found" }),
      } as unknown as Response);

      const result = await client.getResponseIdByDisplayId("missing-display");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.status).toBe(404);
      }
    });
  });

  describe("updateResponse", () => {
    test("updates a response successfully", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: {} }),
      } as unknown as Response);
      const result = await client.updateResponse({
        responseId: "resp123",
        finished: true,
      } as any);
      expect(result.ok).toBe(true);
    });

    test("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ code: "forbidden" }),
      } as unknown as Response);
      const result = await client.updateResponse({
        responseId: "respError",
      } as any);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("forbidden");
      }
    });
  });

  describe("uploadFile", () => {
    test("uploads file (S3) successfully with presigned fields", async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              signedUrl: "https://fake-s3-url.com",
              fileUrl: "https://fake-file-url.com",
              presignedFields: { policy: "test" },
              signingData: null,
              updatedFileName: "test.jpg",
            },
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({ ok: true } as unknown as Response);
      const fileUrl = await client.uploadFile({
        base64: "data:image/jpeg;base64,abcd",
        name: "test.jpg",
        type: "image/jpeg",
      });
      expect(fileUrl).toBe("https://fake-file-url.com");
    });

    test("throws an error if file is invalid", async () => {
      await expect(() => client.uploadFile({ base64: "", name: "", type: "" } as any)).rejects.toThrow(
        "Invalid file object"
      );
    });

    test("throws an error if fetch for signing fails", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ details: { fileName: "Invalid file name" } }),
      } as unknown as Response);
      await expect(() =>
        client.uploadFile({
          base64: "data:image/jpeg;base64,abcd",
          name: "test.jpg",
          type: "image/jpeg",
        })
      ).rejects.toThrow("Invalid file name");
    });

    test("throws StorageNotConfiguredError if signing fails because storage is not configured", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          code: "internal_server_error",
          message: "File storage is not configured correctly. Please check your file upload settings.",
          details: { storage_error_code: STORAGE_ERROR_CODES.S3_CLIENT_ERROR },
        }),
      } as unknown as Response);

      await expect(() =>
        client.uploadFile({
          base64: "data:image/jpeg;base64,abcd",
          name: "test.jpg",
          type: "image/jpeg",
        })
      ).rejects.toMatchObject({ name: FILE_UPLOAD_ERROR_NAMES.STORAGE_NOT_CONFIGURED });
    });

    test("throws an error if actual upload fails", async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              signedUrl: "https://fake-s3-url.com",
              fileUrl: "https://fake-file-url.com",
              presignedFields: { policy: "test" },
              signingData: null,
              updatedFileName: "test.jpg",
            },
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Upload failed",
        } as unknown as Response);
      await expect(() =>
        client.uploadFile({
          base64: "data:image/jpeg;base64,abcd",
          name: "test.jpg",
          type: "image/jpeg",
        })
      ).rejects.toThrow("Upload failed with status: 500");
    });

    test("throws StorageUploadFailedError if actual upload request fails before response", async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              signedUrl: "https://fake-s3-url.com",
              fileUrl: "https://fake-file-url.com",
              presignedFields: { policy: "test" },
              signingData: null,
              updatedFileName: "test.jpg",
            },
          }),
        } as unknown as Response)
        .mockRejectedValueOnce(new Error("Network error"));

      await expect(() =>
        client.uploadFile({
          base64: "data:image/jpeg;base64,abcd",
          name: "test.jpg",
          type: "image/jpeg",
        })
      ).rejects.toMatchObject({ name: FILE_UPLOAD_ERROR_NAMES.STORAGE_UPLOAD_FAILED });
    });

    test('throws "Error uploading file" if base64 is invalid', async () => {
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
});
