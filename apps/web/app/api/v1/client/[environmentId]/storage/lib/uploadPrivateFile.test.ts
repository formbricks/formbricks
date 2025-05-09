import { getUploadSignedUrl } from "@/lib/storage/service";
import { afterEach, describe, expect, test, vi } from "vitest";
import { uploadPrivateFile } from "./uploadPrivateFile";

vi.mock("@/lib/storage/service", () => ({
  getUploadSignedUrl: vi.fn(),
}));

describe("uploadPrivateFile", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return a success response with signed URL details when getUploadSignedUrl successfully generates a signed URL", async () => {
    const mockSignedUrlResponse = {
      signedUrl: "mocked-signed-url",
      presignedFields: { field1: "value1" },
      fileUrl: "mocked-file-url",
    };

    vi.mocked(getUploadSignedUrl).mockResolvedValue(mockSignedUrlResponse);

    const fileName = "test-file.txt";
    const environmentId = "test-env-id";
    const fileType = "text/plain";

    const result = await uploadPrivateFile(fileName, environmentId, fileType);
    const resultData = await result.json();

    expect(getUploadSignedUrl).toHaveBeenCalledWith(fileName, environmentId, fileType, "private", false);

    expect(resultData).toEqual({
      data: mockSignedUrlResponse,
    });
  });

  test("should return a success response when isBiggerFileUploadAllowed is true and getUploadSignedUrl successfully generates a signed URL", async () => {
    const mockSignedUrlResponse = {
      signedUrl: "mocked-signed-url",
      presignedFields: { field1: "value1" },
      fileUrl: "mocked-file-url",
    };

    vi.mocked(getUploadSignedUrl).mockResolvedValue(mockSignedUrlResponse);

    const fileName = "test-file.txt";
    const environmentId = "test-env-id";
    const fileType = "text/plain";
    const isBiggerFileUploadAllowed = true;

    const result = await uploadPrivateFile(fileName, environmentId, fileType, isBiggerFileUploadAllowed);
    const resultData = await result.json();

    expect(getUploadSignedUrl).toHaveBeenCalledWith(
      fileName,
      environmentId,
      fileType,
      "private",
      isBiggerFileUploadAllowed
    );

    expect(resultData).toEqual({
      data: mockSignedUrlResponse,
    });
  });

  test("should return an internal server error response when getUploadSignedUrl throws an error", async () => {
    vi.mocked(getUploadSignedUrl).mockRejectedValue(new Error("S3 unavailable"));

    const fileName = "test-file.txt";
    const environmentId = "test-env-id";
    const fileType = "text/plain";

    const result = await uploadPrivateFile(fileName, environmentId, fileType);

    expect(result.status).toBe(500);
    const resultData = await result.json();
    expect(resultData).toEqual({
      code: "internal_server_error",
      details: {},
      message: "Internal server error",
    });
  });

  test("should return an internal server error response when fileName has no extension", async () => {
    vi.mocked(getUploadSignedUrl).mockRejectedValue(new Error("File extension not found"));

    const fileName = "test-file";
    const environmentId = "test-env-id";
    const fileType = "text/plain";

    const result = await uploadPrivateFile(fileName, environmentId, fileType);
    const resultData = await result.json();

    expect(getUploadSignedUrl).toHaveBeenCalledWith(fileName, environmentId, fileType, "private", false);
    expect(result.status).toBe(500);
    expect(resultData).toEqual({
      code: "internal_server_error",
      details: {},
      message: "Internal server error",
    });
  });
});
