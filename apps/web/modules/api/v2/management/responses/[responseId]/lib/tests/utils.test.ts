import { fileUploadQuestion, openTextQuestion, responseData, workspaceId } from "./__mocks__/utils.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { okVoid } from "@formbricks/types/error-handlers";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { deleteFile } from "@/modules/storage/service";
import { findAndDeleteUploadedFilesInResponse } from "../utils";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: vi.fn(),
}));

vi.mock("@/modules/storage/service", () => ({
  deleteFile: vi.fn(),
}));

// The delete helper takes a survey shape ({ blocks, questions }); most cases here only use questions.
const questionsSurvey = (questions: unknown[]) => ({ questions, blocks: [] }) as any;

describe("findAndDeleteUploadedFilesInResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: every storage id resolves back to the survey's own workspace, so deletion is authorized.
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValue({
      id: workspaceId,
      organizationId: "org-1",
    });
    vi.mocked(deleteFile).mockResolvedValue({ ok: true, data: undefined });
  });

  test("delete files for file upload questions and return okVoid", async () => {
    const result = await findAndDeleteUploadedFilesInResponse(
      responseData,
      questionsSurvey([fileUploadQuestion]),
      workspaceId
    );

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenCalledWith(workspaceId, "private", "file1.png", workspaceId);
    expect(deleteFile).toHaveBeenCalledWith(workspaceId, "private", "file2.pdf", workspaceId);
    expect(result).toEqual(okVoid());
  });

  // File uploads can live in blocks instead of questions; this path used to key off questions only, so
  // it silently deleted nothing for block-based surveys and leaked their uploads.
  test("delete files for block-based file-upload elements", async () => {
    const elementId = "block-file-upload-element";
    const blockSurvey = {
      questions: [],
      blocks: [{ id: "block-1", elements: [{ id: elementId, type: TSurveyElementTypeEnum.FileUpload }] }],
    } as any;
    const blockResponseData = {
      [elementId]: [`https://example.com/storage/${workspaceId}/private/block-file.png`],
    } as any;

    const result = await findAndDeleteUploadedFilesInResponse(blockResponseData, blockSurvey, workspaceId);

    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith(workspaceId, "private", "block-file.png", workspaceId);
    expect(result).toEqual(okVoid());
  });

  test("not call deleteFile if no file upload questions match response data", async () => {
    const result = await findAndDeleteUploadedFilesInResponse(
      responseData,
      questionsSurvey([openTextQuestion]),
      workspaceId
    );

    expect(deleteFile).not.toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });

  // A planted URL pointing into another tenant's storage prefix must not be deleted, even though the
  // survey now lists a file-upload question whose id matches the planted response key (the TOCTOU).
  test("refuse to delete a file whose storage id belongs to a different workspace", async () => {
    const foreignWorkspaceId = "foreign-workspace-id";
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValue({
      id: foreignWorkspaceId,
      organizationId: "org-2",
    });

    const plantedData = {
      [fileUploadQuestion.id]: [`https://example.com/storage/${foreignWorkspaceId}/public/victim.png`],
    } as any;

    const result = await findAndDeleteUploadedFilesInResponse(
      plantedData,
      questionsSurvey([fileUploadQuestion]),
      workspaceId
    );

    expect(deleteFile).not.toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });

  test("handle invalid file URLs and log errors", async () => {
    const invalidFileUrl = "https://example.com/invalid-url";
    const invalidResponseData = {
      [fileUploadQuestion.id]: [invalidFileUrl],
    } as any;

    const loggerSpy = vi.spyOn(logger, "error");

    const result = await findAndDeleteUploadedFilesInResponse(
      invalidResponseData,
      questionsSurvey([fileUploadQuestion]),
      workspaceId
    );

    expect(deleteFile).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
    expect(result).toEqual(okVoid());

    loggerSpy.mockRestore();
  });

  test("process multiple file URLs", async () => {
    const result = await findAndDeleteUploadedFilesInResponse(
      responseData,
      questionsSurvey([fileUploadQuestion]),
      workspaceId
    );

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenCalledWith(workspaceId, "private", "file1.png", workspaceId);
    expect(deleteFile).toHaveBeenCalledWith(workspaceId, "private", "file2.pdf", workspaceId);
    expect(result).toEqual(okVoid());
  });
});
