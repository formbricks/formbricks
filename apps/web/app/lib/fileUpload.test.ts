import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fileUploadModule from "./fileUpload";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockAtoB = vi.fn();
global.atob = mockAtoB;

// Mock FileReader
const mockFileReader = {
  readAsDataURL: vi.fn(),
  result: "data:image/jpeg;base64,test",
  onload: null as any,
  onerror: null as any,
};

// Mock File object
const createMockFile = (name: string, type: string, size: number) => {
  const file = new File([], name, { type });
  Object.defineProperty(file, "size", {
    value: size,
    writable: false,
  });
  return file;
};

describe("fileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock FileReader
    global.FileReader = vi.fn(() => mockFileReader) as any;
    global.atob = (base64) => Buffer.from(base64, "base64").toString("binary");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return error when no file is provided", async () => {
    const result = await fileUploadModule.handleFileUpload(null as any, "test-env");
    expect(result.error).toBe(fileUploadModule.FileUploadError.NO_FILE);
    expect(result.url).toBe("");
  });

  test("should return error when file is not an image", async () => {
    const file = createMockFile("test.pdf", "application/pdf", 1000);
    const result = await fileUploadModule.handleFileUpload(file, "test-env");
    expect(result.error).toBe("Please upload an image file.");
    expect(result.url).toBe("");
  });

  test("should return FILE_SIZE_EXCEEDED if arrayBuffer is > 10MB even if file.size is OK", async () => {
    const file = createMockFile("test.jpg", "image/jpeg", 1000); // file.size = 1KB

    // Mock arrayBuffer to return >10MB buffer
    file.arrayBuffer = vi.fn().mockResolvedValueOnce(new ArrayBuffer(11 * 1024 * 1024)); // 11MB

    const result = await fileUploadModule.handleFileUpload(file, "env-oversize-buffer");

    expect(result.error).toBe(fileUploadModule.FileUploadError.FILE_SIZE_EXCEEDED);
    expect(result.url).toBe("");
  });

  test("should handle API error when getting signed URL", async () => {
    const file = createMockFile("test.jpg", "image/jpeg", 1000);

    // Mock failed API response
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    const result = await fileUploadModule.handleFileUpload(file, "test-env");
    expect(result.error).toBe("Upload failed. Please try again.");
    expect(result.url).toBe("");
  });

  test("should handle successful file upload with presigned fields", async () => {
    const file = createMockFile("test.jpg", "image/jpeg", 1000);

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          signedUrl: "https://s3.example.com/upload",
          fileUrl: "https://s3.example.com/file.jpg",
          presignedFields: {
            key: "value",
          },
        },
      }),
    });

    // Mock successful upload response
    mockFetch.mockResolvedValueOnce({
      ok: true,
    });

    // Simulate FileReader onload
    setTimeout(() => {
      mockFileReader.onload();
    }, 0);

    const result = await fileUploadModule.handleFileUpload(file, "test-env");
    expect(result.error).toBeUndefined();
    expect(result.url).toBe("https://s3.example.com/file.jpg");
  });

  test("should handle successful file upload without presigned fields", async () => {
    const file = createMockFile("test.jpg", "image/jpeg", 1000);

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          signedUrl: "https://s3.example.com/upload",
          fileUrl: "https://s3.example.com/file.jpg",
          signingData: {
            signature: "test-signature",
            timestamp: 1234567890,
            uuid: "test-uuid",
          },
        },
      }),
    });

    // Mock successful upload response
    mockFetch.mockResolvedValueOnce({
      ok: true,
    });

    // Simulate FileReader onload
    setTimeout(() => {
      mockFileReader.onload();
    }, 0);

    const result = await fileUploadModule.handleFileUpload(file, "test-env");
    expect(result.error).toBeUndefined();
    expect(result.url).toBe("https://s3.example.com/file.jpg");
  });

  test("should handle upload error with presigned fields", async () => {
    const file = createMockFile("test.jpg", "image/jpeg", 1000);
    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          signedUrl: "https://s3.example.com/upload",
          fileUrl: "https://s3.example.com/file.jpg",
          presignedFields: {
            key: "value",
          },
        },
      }),
    });

    global.atob = vi.fn(() => {
      throw new Error("Failed to decode base64 string");
    });

    // Simulate FileReader onload
    setTimeout(() => {
      mockFileReader.onload();
    }, 0);

    const result = await fileUploadModule.handleFileUpload(file, "test-env");
    expect(result.error).toBe("Upload failed. Please try again.");
    expect(result.url).toBe("");
  });

  test("should handle upload error", async () => {
    const file = createMockFile("test.jpg", "image/jpeg", 1000);

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          signedUrl: "https://s3.example.com/upload",
          fileUrl: "https://s3.example.com/file.jpg",
          presignedFields: {
            key: "value",
          },
        },
      }),
    });

    // Mock failed upload response
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    // Simulate FileReader onload
    setTimeout(() => {
      mockFileReader.onload();
    }, 0);

    const result = await fileUploadModule.handleFileUpload(file, "test-env");
    expect(result.error).toBe("Upload failed. Please try again.");
    expect(result.url).toBe("");
  });

  test("should catch unexpected errors and return UPLOAD_FAILED", async () => {
    const file = createMockFile("test.jpg", "image/jpeg", 1000);

    // Force arrayBuffer() to throw
    file.arrayBuffer = vi.fn().mockImplementation(() => {
      throw new Error("Unexpected crash in arrayBuffer");
    });

    const result = await fileUploadModule.handleFileUpload(file, "env-crash");

    expect(result.error).toBe(fileUploadModule.FileUploadError.UPLOAD_FAILED);
    expect(result.url).toBe("");
  });
});

describe("fileUploadModule.toBase64", () => {
  test("resolves with base64 string when FileReader succeeds", async () => {
    const dummyFile = new File(["hello"], "hello.txt", { type: "text/plain" });

    // Mock FileReader
    const mockReadAsDataURL = vi.fn();
    const mockFileReaderInstance = {
      readAsDataURL: mockReadAsDataURL,
      onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null,
      onerror: null,
      result: "data:text/plain;base64,aGVsbG8=",
    };

    globalThis.FileReader = vi.fn(() => mockFileReaderInstance as unknown as FileReader) as any;

    const promise = fileUploadModule.toBase64(dummyFile);

    // Trigger the onload manually
    mockFileReaderInstance.onload?.call(mockFileReaderInstance as unknown as FileReader, new Error("load"));

    const result = await promise;
    expect(result).toBe("data:text/plain;base64,aGVsbG8=");
  });

  test("rejects when FileReader errors", async () => {
    const dummyFile = new File(["oops"], "oops.txt", { type: "text/plain" });

    const mockReadAsDataURL = vi.fn();
    const mockFileReaderInstance = {
      readAsDataURL: mockReadAsDataURL,
      onload: null,
      onerror: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null,
      result: null,
    };

    globalThis.FileReader = vi.fn(() => mockFileReaderInstance as unknown as FileReader) as any;

    const promise = fileUploadModule.toBase64(dummyFile);

    // Simulate error
    mockFileReaderInstance.onerror?.call(mockFileReaderInstance as unknown as FileReader, new Error("error"));

    await expect(promise).rejects.toThrow();
  });
});
