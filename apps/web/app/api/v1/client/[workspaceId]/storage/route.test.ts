import { beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_FILE_UPLOAD_SIZES } from "@/lib/constants";
import { generateSurveySingleUseSignature } from "@/lib/utils/single-use-surveys";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getBiggerUploadFileSizePermission: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getSignedUrlForUpload: vi.fn(),
  getSurvey: vi.fn(),
  resolveClientApiIds: vi.fn(),
  validateSurveyAllowsFileUpload: vi.fn(),
  verifyLinkSurveyPinToken: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
// The real single-use validator runs here, so a refusal below is the production decision and not a
// stub's. Its signing key is mocked in both places it is read.
vi.mock("@/lib/constants", async (importOriginal: () => Promise<typeof import("@/lib/constants")>) => ({
  ...(await importOriginal()),
  ENCRYPTION_KEY: "test-key",
}));
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: "test-key" } }));
vi.mock("@/modules/survey/link/lib/pin-token", () => ({
  verifyLinkSurveyPinToken: mocks.verifyLinkSurveyPinToken,
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));
vi.mock("@/lib/utils/resolve-client-id", () => ({ resolveClientApiIds: mocks.resolveClientApiIds }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getBiggerUploadFileSizePermission: mocks.getBiggerUploadFileSizePermission,
}));
vi.mock("@/modules/storage/service", () => ({ getSignedUrlForUpload: mocks.getSignedUrlForUpload }));
vi.mock("@/modules/storage/utils", () => ({
  getErrorResponseFromStorageError: vi.fn(),
  validateSurveyAllowsFileUpload: mocks.validateSurveyAllowsFileUpload,
}));

const WORKSPACE_ID = "cm0wwwwwwwwwwwwwwwwwwwww1";
const SURVEY_ID = "cm0aaaaaaaaaaaaaaaaaaaaa1";
const SINGLE_USE_ID = "cm0suaaaaaaaaaaaaaaaaaaa1";

const singleUseSurvey = {
  id: SURVEY_ID,
  workspaceId: WORKSPACE_ID,
  type: "link",
  status: "inProgress",
  singleUse: { enabled: true, isEncrypted: false },
};

const validSingleUseLink = `https://x.test/s/${SURVEY_ID}?suId=${SINGLE_USE_ID}&suToken=${generateSurveySingleUseSignature(SURVEY_ID, SINGLE_USE_ID)}`;

const callPost = (extra: Record<string, unknown> = {}) =>
  (POST as unknown as (args: unknown) => Promise<{ response: Response }>)({
    req: new Request("http://localhost/api/v1/client/ws/storage", {
      method: "POST",
      body: JSON.stringify({
        fileName: "photo.png",
        fileType: "image/png",
        surveyId: SURVEY_ID,
        elementId: "file-el",
        ...extra,
      }),
    }),
    props: { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) },
  });

describe("POST /api/v1/client/[workspaceId]/storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId: WORKSPACE_ID });
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org-1");
    mocks.getOrganization.mockResolvedValue({ id: "org-1" });
    mocks.getSurvey.mockResolvedValue({
      id: SURVEY_ID,
      workspaceId: WORKSPACE_ID,
      type: "link",
      status: "inProgress",
    });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.getBiggerUploadFileSizePermission.mockResolvedValue(false);
    mocks.verifyLinkSurveyPinToken.mockReturnValue(true);
    mocks.validateSurveyAllowsFileUpload.mockReturnValue({ ok: true });
    mocks.getSignedUrlForUpload.mockResolvedValue({
      ok: true,
      data: { signedUrl: "https://s3/upload", fileUrl: "/storage/x", presignedFields: {} },
    });
  });

  test("refuses a PIN-protected survey when the PIN token does not verify", async () => {
    mocks.getSurvey.mockResolvedValue({
      id: SURVEY_ID,
      workspaceId: WORKSPACE_ID,
      type: "link",
      status: "inProgress",
      pin: "1234",
    });
    mocks.verifyLinkSurveyPinToken.mockReturnValue(false);

    const { response } = await callPost({ pinAuthToken: "bad" });

    expect(response.status).toBe(403);
    expect(mocks.verifyLinkSurveyPinToken).toHaveBeenCalledWith("bad", SURVEY_ID);
    expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("issues an upload URL for a PIN-protected survey with a valid PIN token", async () => {
    mocks.getSurvey.mockResolvedValue({
      id: SURVEY_ID,
      workspaceId: WORKSPACE_ID,
      type: "link",
      status: "inProgress",
      pin: "1234",
    });

    const { response } = await callPost({ pinAuthToken: "good" });

    expect(response.status).toBe(200);
    expect(mocks.getSignedUrlForUpload).toHaveBeenCalledOnce();
  });

  test("refuses a single-use survey when the request carries no single-use id", async () => {
    mocks.getSurvey.mockResolvedValue(singleUseSurvey);

    const { response } = await callPost();

    expect(response.status).toBe(400);
    expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("refuses a single-use survey when the link signature does not match the survey", async () => {
    mocks.getSurvey.mockResolvedValue(singleUseSurvey);

    const { response } = await callPost({
      singleUseId: SINGLE_USE_ID,
      url: `https://x.test/s/${SURVEY_ID}?suId=${SINGLE_USE_ID}&suToken=forged`,
    });

    expect(response.status).toBe(400);
    expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("issues an upload URL for a single-use survey with a validly signed link", async () => {
    mocks.getSurvey.mockResolvedValue(singleUseSurvey);

    const { response } = await callPost({ singleUseId: SINGLE_USE_ID, url: validSingleUseLink });

    expect(response.status).toBe(200);
    expect(mocks.getSignedUrlForUpload).toHaveBeenCalledOnce();
  });

  test("a survey with neither PIN nor single-use behaves as before", async () => {
    const { response } = await callPost();

    expect(response.status).toBe(200);
    expect(mocks.verifyLinkSurveyPinToken).not.toHaveBeenCalled();
    expect(mocks.getSignedUrlForUpload).toHaveBeenCalledOnce();
  });
});

/**
 * The public upload endpoint hands an anonymous caller a presigned URL. It used to do so for any
 * survey that existed in the workspace, whatever its status — so a survey closed for good still wrote
 * objects into the bucket, under a prefix no response could ever point at (ENG-4044).
 *
 * `withV1ApiWrapper` is reduced to its handler: the IP rate limit and audit logging it adds are
 * orthogonal to what is proved here.
 */
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

const expectRefusedBeforeSigning = async (result: { response: Response }) => {
  expect(result.response.status).toBe(403);
  await expect(result.response.json()).resolves.toEqual({
    code: "forbidden",
    message: "Survey is not accepting submissions",
    details: { surveyId },
  });
  // No URL is signed and no licence lookup runs: the refusal has to land before either.
  expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
  expect(mocks.getBiggerUploadFileSizePermission).not.toHaveBeenCalled();
  // A refused request does not spend the workspace's upload quota, so a closed survey cannot be used
  // to drain the budget its workspace's open surveys rely on.
  expect(mocks.applyRateLimit).not.toHaveBeenCalled();
  // The element and file-type checks are skipped rather than answered, so a closed survey cannot be
  // probed for which elements it carries.
  expect(mocks.validateSurveyAllowsFileUpload).not.toHaveBeenCalled();
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

      await expectRefusedBeforeSigning(await postUpload());
    }
  );

  /**
   * The `archivedAt` read is the second gate, not a restatement of the first. Archiving only forces
   * `paused` on a survey that was `inProgress`, so a survey can carry `archivedAt` under any status,
   * and a publish racing an archive can leave it `inProgress` and archived at once. This seeds that
   * pair directly to prove the route refuses on `archivedAt` alone.
   */
  test("refuses an upload URL for an archived survey that still reads as in progress", async () => {
    mocks.getSurvey.mockResolvedValue(getSurveyWith({ status: "inProgress", archivedAt: new Date() }));

    await expectRefusedBeforeSigning(await postUpload());
  });

  test("still issues an upload URL for an open survey, scoped to its element", async () => {
    const survey = getSurveyWith({});

    const result = await postUpload();

    expect(result.response.status).toBe(200);
    await expect(result.response.json()).resolves.toEqual({
      data: { signedUrl: "https://s3.test/signed", fileUrl: "/storage/survey/private/file.png" },
    });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.storage.uploadPerWorkspace,
      workspaceId
    );
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
      MAX_FILE_UPLOAD_SIZES.standard,
      ["surveys", surveyId, "elements", elementId]
    );
  });
});
