import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteFile } from "@formbricks/lib/storage/service";
import { okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { findAndDeleteUploadedFilesInResponse } from "../utils";

// mock the deleteFile dependency
vi.mock("@formbricks/lib/storage/service", () => ({
  deleteFile: vi.fn(),
}));

describe("findAndDeleteUploadedFilesInResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete files for file upload questions and return okVoid", async () => {
    const validFileUrl = "https://example.com/env_1/private/test.png";
    const responseData = {
      q1: [validFileUrl],
      q2: ["Some text"],
    };
    const questions = [
      { id: "q1", type: TSurveyQuestionTypeEnum.FileUpload },
      { id: "q2", type: "OpenText" },
    ];

    // resolve deleteFile as successful
    (deleteFile as unknown as jest.Mock).mockResolvedValue(true);

    const result = await findAndDeleteUploadedFilesInResponse(responseData, questions);

    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith("env_1", "private", "test.png");
    expect(result).toEqual(okVoid());
  });

  it("should not call deleteFile if no file upload questions match response data", async () => {
    const responseData = {
      q2: ["Just some text"],
    };
    const questions = [
      { id: "q1", type: TSurveyQuestionTypeEnum.FileUpload },
      { id: "q2", type: "OpenText" },
    ];

    const result = await findAndDeleteUploadedFilesInResponse(responseData, questions);

    expect(deleteFile).not.toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });

  it("should handle invalid file URLs and log errors", async () => {
    const invalidFileUrl = "https://example.com/invalid-url";
    const responseData = {
      q1: [invalidFileUrl],
    };
    const questions = [{ id: "q1", type: TSurveyQuestionTypeEnum.FileUpload }];

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await findAndDeleteUploadedFilesInResponse(responseData, questions);

    expect(deleteFile).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(result).toEqual(okVoid());

    consoleErrorSpy.mockRestore();
  });

  it("should process multiple file URLs", async () => {
    const validFileUrl1 = "https://example.com/env_1/private/file1.png";
    const validFileUrl2 = "https://example.com/env_1/public/file2.pdf";
    const responseData = {
      q1: [validFileUrl1, validFileUrl2],
    };
    const questions = [{ id: "q1", type: TSurveyQuestionTypeEnum.FileUpload }];

    (deleteFile as unknown as jest.Mock).mockResolvedValue(true);

    const result = await findAndDeleteUploadedFilesInResponse(responseData, questions);

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenNthCalledWith(1, "env_1", "private", "file1.png");
    expect(deleteFile).toHaveBeenNthCalledWith(2, "env_1", "public", "file2.pdf");
    expect(result).toEqual(okVoid());
  });
});
