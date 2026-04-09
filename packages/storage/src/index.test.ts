import { describe, expect, test } from "vitest";
import * as storage from "./index";

describe("@formbricks/storage public API", () => {
  test("exports the runtime storage entry points and error enum", () => {
    expect(storage.getSignedUploadUrl).toBeTypeOf("function");
    expect(storage.getSignedDownloadUrl).toBeTypeOf("function");
    expect(storage.getFileStream).toBeTypeOf("function");
    expect(storage.deleteFile).toBeTypeOf("function");
    expect(storage.deleteFilesByPrefix).toBeTypeOf("function");
    expect(storage.StorageErrorCode).toBeDefined();
    expect("StorageError" in storage).toBe(false);
  });
});
