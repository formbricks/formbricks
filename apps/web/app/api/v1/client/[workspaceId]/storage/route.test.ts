import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

/**
 * The public upload endpoint hands an anonymous caller a presigned URL. It used to do so for any
 * survey that existed in the workspace, whatever its status — so a survey closed for good still wrote
 * objects into the bucket, under a prefix no response could ever point at (ENG-4044).
 *
 * `withV1ApiWrapper` is reduced to its handler: the IP rate limit and audit logging it adds are
 * orthogonal to what is proved here.
 */
const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getBiggerUploadFileSizePermission: vi.fn(),
  getErrorResponseFromStorageError: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getSignedUrlForUpload: vi.fn(),
  getSurvey: vi.fn(),
  resolveClientApiIds: vi.fn(),
  validateSurveyAllowsFileUpload: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/lib/constants", () => ({
  MAX_FILE_UPLOAD_SIZES: { standard: 10 * 1024 * 1024, big: 100 * 1024 * 1024 },
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mocks.getSurvey,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: mocks.resolveClientApiIds,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getBiggerUploadFileSizePermission: mocks.getBiggerUploadFileSizePermission,
}));

vi.mock("@/modules/storage/service", () => ({
  getSignedUrlForUpload: mocks.getSignedUrlForUpload,
}));

vi.mock("@/modules/storage/utils", () => ({
  getErrorResponseFromStorageError: mocks.getErrorResponseFromStorageError,
  validateSurveyAllowsFileUpload: mocks.validateSurveyAllowsFileUpload,
}));

const workspaceId = "lygo31gfsexlr4lh6rq8dxyl";
const surveyId = "cgt5e6dw1vsf1bv2ki5gj845";
const elementId = "element-1";

const uploadBody = { fileName: "file.png", fileType: "image/png", surveyId, elementId };

const getSurveyWith = (overrides: Record<string, unknown>) => ({
  id: surveyId,
  workspaceId,
  status: "inProgress",
  archivedAt: null,
  blocks: [{ id: "block_1", elements: [{ id: elementId }] }],
  questions: [],
  ...overrides,
});

const postUpload = async () => {
  const req = new Request(`https://api.test/api/v1/client/${workspaceId}/storage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(uploadBody),
  });

  return (POST as unknown as (params: unknown) => Promise<{ response: Response }>)({
    req,
    props: { params: Promise.resolve({ workspaceId }) },
  });
};

describe("POST /api/v1/client/[workspaceId]/storage — survey lifecycle gates (ENG-4044)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId });
    mocks.getSurvey.mockResolvedValue(getSurveyWith({}));
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org_1");
    mocks.getOrganization.mockResolvedValue({ id: "org_1" });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.validateSurveyAllowsFileUpload.mockReturnValue({ ok: true });
    mocks.getBiggerUploadFileSizePermission.mockResolvedValue(false);
    mocks.getSignedUrlForUpload.mockResolvedValue({
      ok: true,
      data: { signedUrl: "https://s3.test/signed", fileUrl: "/storage/survey/private/file.png" },
    });
  });

  test.each(["draft", "paused", "completed"] as const)(
    "refuses an upload URL for a %s survey",
    async (status) => {
      mocks.getSurvey.mockResolvedValue(getSurveyWith({ status }));

      const result = await postUpload();

      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        code: "forbidden",
        message: "Survey is not accepting submissions",
        details: { surveyId },
      });
      // No URL is signed and no licence lookup runs: the refusal has to land before either.
      expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
      expect(mocks.getBiggerUploadFileSizePermission).not.toHaveBeenCalled();
    }
  );

  /**
   * Archiving only forces `paused` on a survey that was `inProgress` — a draft or completed one is
   * archived with its status untouched, so the status gate alone would still sign for it.
   */
  test("refuses an upload URL for an archived survey that still reads as in progress", async () => {
    mocks.getSurvey.mockResolvedValue(getSurveyWith({ status: "inProgress", archivedAt: new Date() }));

    const result = await postUpload();

    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({
      code: "forbidden",
      message: "Survey is not accepting submissions",
      details: { surveyId },
    });
    expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("still issues an upload URL for an open survey, scoped to its element", async () => {
    const survey = getSurveyWith({});

    const result = await postUpload();

    expect(result.response.status).toBe(200);
    await expect(result.response.json()).resolves.toEqual({
      data: { signedUrl: "https://s3.test/signed", fileUrl: "/storage/survey/private/file.png" },
    });
    expect(mocks.validateSurveyAllowsFileUpload).toHaveBeenCalledWith({
      fileName: uploadBody.fileName,
      elementId,
      blocks: survey.blocks,
      questions: survey.questions,
    });
    expect(mocks.getSignedUrlForUpload).toHaveBeenCalledWith(
      uploadBody.fileName,
      workspaceId,
      uploadBody.fileType,
      "private",
      expect.any(Number),
      ["surveys", surveyId, "elements", elementId]
    );
  });
});
