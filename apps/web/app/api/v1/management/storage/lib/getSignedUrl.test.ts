import { responses } from "@/app/lib/api/response";
import { getUploadSignedUrl } from "@/lib/storage/service";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getSignedUrlForPublicFile } from "./getSignedUrl";

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    successResponse: vi.fn((data) => ({ data })),
    internalServerErrorResponse: vi.fn((message) => ({ message })),
  },
}));

vi.mock("@/lib/storage/service", () => ({
  getUploadSignedUrl: vi.fn(),
}));

describe("getSignedUrlForPublicFile", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("should return success response with signed URL data", async () => {
    const mockFileName = "test.jpg";
    const mockEnvironmentId = "env123";
    const mockFileType = "image/jpeg";
    const mockSignedUrlResponse = {
      signedUrl: "http://example.com/signed-url",
      signingData: { signature: "sig", timestamp: 123, uuid: "uuid" },
      updatedFileName: "test--fid--uuid.jpg",
      fileUrl: "http://example.com/file-url",
    };

    vi.mocked(getUploadSignedUrl).mockResolvedValue(mockSignedUrlResponse);

    const result = await getSignedUrlForPublicFile(mockFileName, mockEnvironmentId, mockFileType);

    expect(getUploadSignedUrl).toHaveBeenCalledWith(mockFileName, mockEnvironmentId, mockFileType, "public");
    expect(responses.successResponse).toHaveBeenCalledWith(mockSignedUrlResponse);
    expect(result).toEqual({ data: mockSignedUrlResponse });
  });

  test("should return internal server error response when getUploadSignedUrl throws an error", async () => {
    const mockFileName = "test.png";
    const mockEnvironmentId = "env456";
    const mockFileType = "image/png";
    const mockError = new Error("Failed to get signed URL");

    vi.mocked(getUploadSignedUrl).mockRejectedValue(mockError);

    const result = await getSignedUrlForPublicFile(mockFileName, mockEnvironmentId, mockFileType);

    expect(getUploadSignedUrl).toHaveBeenCalledWith(mockFileName, mockEnvironmentId, mockFileType, "public");
    expect(responses.internalServerErrorResponse).toHaveBeenCalledWith("Internal server error");
    expect(result).toEqual({ message: "Internal server error" });
  });
});
