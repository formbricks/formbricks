import { environmentId, fileUploadQuestion, openTextQuestion, responseData } from "./__mocks__/utils.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { deleteFile } from "@formbricks/lib/storage/service";
import { logger } from "@formbricks/logger";
import { okVoid } from "@formbricks/types/error-handlers";
import { findAndDeleteUploadedFilesInResponse } from "../utils";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@formbricks/lib/storage/service", () => ({
  deleteFile: vi.fn(),
}));

describe("findAndDeleteUploadedFilesInResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("delete files for file upload questions and return okVoid", async () => {
    vi.mocked(deleteFile).mockResolvedValue({ success: true, message: "File deleted successfully" });

    const result = await findAndDeleteUploadedFilesInResponse(responseData, [fileUploadQuestion]);

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenCalledWith(environmentId, "private", "file1.png");
    expect(deleteFile).toHaveBeenCalledWith(environmentId, "private", "file2.pdf");
    expect(result).toEqual(okVoid());
  });

  test("not call deleteFile if no file upload questions match response data", async () => {
    const result = await findAndDeleteUploadedFilesInResponse(responseData, [openTextQuestion]);

    expect(deleteFile).not.toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });

  test("handle invalid file URLs and log errors", async () => {
    const invalidFileUrl = "https://example.com/invalid-url";
    const responseData = {
      [fileUploadQuestion.id]: [invalidFileUrl],
    };

    const loggerSpy = vi.spyOn(logger, "error");

    const result = await findAndDeleteUploadedFilesInResponse(responseData, [fileUploadQuestion]);

    expect(deleteFile).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
    expect(result).toEqual(okVoid());

    loggerSpy.mockRestore();
  });

  test("process multiple file URLs", async () => {
    vi.mocked(deleteFile).mockResolvedValue({ success: true, message: "File deleted successfully" });

    const result = await findAndDeleteUploadedFilesInResponse(responseData, [fileUploadQuestion]);

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenNthCalledWith(1, environmentId, "private", "file1.png");
    expect(deleteFile).toHaveBeenNthCalledWith(2, environmentId, "private", "file2.pdf");
    expect(result).toEqual(okVoid());
  });
});
