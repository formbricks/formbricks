import { fileUploadQuestion, openTextQuestion, responseData, workspaceId } from "./__mocks__/utils.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { okVoid } from "@formbricks/types/error-handlers";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { deleteFile } from "@/modules/storage/service";
import { findAndDeleteUploadedFilesInResponse } from "../utils";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/modules/storage/service", () => ({
  deleteFile: vi.fn(),
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: vi.fn(),
}));

describe("findAndDeleteUploadedFilesInResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default every storage id resolves to the workspace that owns the response.
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockImplementation(async (id: string) => ({
      id,
      organizationId: "org_1",
    }));
  });

  test("delete files for file upload questions and return okVoid", async () => {
    vi.mocked(deleteFile).mockResolvedValue({ ok: true, data: undefined });

    const result = await findAndDeleteUploadedFilesInResponse(
      responseData,
      [fileUploadQuestion],
      workspaceId
    );

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenCalledWith(workspaceId, "private", "file1.png", workspaceId);
    expect(deleteFile).toHaveBeenCalledWith(workspaceId, "private", "file2.pdf", workspaceId);
    expect(result).toEqual(okVoid());
  });

  test("not call deleteFile if no file upload questions match response data", async () => {
    const result = await findAndDeleteUploadedFilesInResponse(responseData, [openTextQuestion], workspaceId);

    expect(deleteFile).not.toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });

  test("handle invalid file URLs and log errors", async () => {
    const invalidFileUrl = "https://example.com/invalid-url";
    const responseDataWithInvalidUrl = {
      [fileUploadQuestion.id]: [invalidFileUrl],
    };

    const result = await findAndDeleteUploadedFilesInResponse(
      responseDataWithInvalidUrl,
      [fileUploadQuestion],
      workspaceId
    );

    expect(deleteFile).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });

  test("process multiple file URLs", async () => {
    vi.mocked(deleteFile).mockResolvedValue({ ok: true, data: undefined });

    const result = await findAndDeleteUploadedFilesInResponse(
      responseData,
      [fileUploadQuestion],
      workspaceId
    );

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenNthCalledWith(1, workspaceId, "private", "file1.png", workspaceId);
    expect(deleteFile).toHaveBeenNthCalledWith(2, workspaceId, "private", "file2.pdf", workspaceId);
    expect(result).toEqual(okVoid());
  });

  // Regression: the URLs come from response data, and the management API validates only the file
  // extension — so a response could name another tenant's storage prefix and have this delete their
  // object.
  test("refuse to delete files stored outside the survey's workspace", async () => {
    const victimWorkspaceId = "victimworkspaceid00000000";
    const responseDataWithForeignUrl = {
      [fileUploadQuestion.id]: [`https://example.com/storage/${victimWorkspaceId}/private/secret.pdf`],
    };

    const result = await findAndDeleteUploadedFilesInResponse(
      responseDataWithForeignUrl,
      [fileUploadQuestion],
      workspaceId
    );

    expect(deleteFile).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });

  test("delete files uploaded under a legacy environment id of the same workspace", async () => {
    const legacyEnvironmentId = "legacyenvironmentid000000";
    vi.mocked(deleteFile).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValue({
      id: workspaceId,
      organizationId: "org_1",
    });

    const result = await findAndDeleteUploadedFilesInResponse(
      { [fileUploadQuestion.id]: [`https://example.com/storage/${legacyEnvironmentId}/private/file1.png`] },
      [fileUploadQuestion],
      workspaceId
    );

    expect(deleteFile).toHaveBeenCalledWith(legacyEnvironmentId, "private", "file1.png", workspaceId);
    expect(result).toEqual(okVoid());
  });

  test("delete nothing when the owning workspace is unknown", async () => {
    const result = await findAndDeleteUploadedFilesInResponse(responseData, [fileUploadQuestion], undefined);

    expect(deleteFile).not.toHaveBeenCalled();
    expect(result).toEqual(okVoid());
  });
});
