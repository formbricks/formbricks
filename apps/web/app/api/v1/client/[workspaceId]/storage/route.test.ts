import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateSurveySingleUseSignature } from "@/lib/utils/single-use-surveys";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getBiggerUploadFileSizePermission: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getSignedUrlForUpload: vi.fn(),
  getSurvey: vi.fn(),
  resolveClientApiIds: vi.fn(),
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
  validateSurveyAllowsFileUpload: vi.fn(() => ({ ok: true })),
}));

const WORKSPACE_ID = "cm0wwwwwwwwwwwwwwwwwwwww1";
const SURVEY_ID = "cm0aaaaaaaaaaaaaaaaaaaaa1";
const SINGLE_USE_ID = "cm0suaaaaaaaaaaaaaaaaaaa1";

const singleUseSurvey = {
  id: SURVEY_ID,
  workspaceId: WORKSPACE_ID,
  type: "link",
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
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: WORKSPACE_ID, type: "link" });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.getBiggerUploadFileSizePermission.mockResolvedValue(false);
    mocks.verifyLinkSurveyPinToken.mockReturnValue(true);
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
