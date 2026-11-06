import { beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_RESPONSE_DATA_KEYS } from "@formbricks/types/responses";
import { PUT } from "./route";

// `withV1ApiWrapper` is reduced to its handler, and authorization is granted: what is proved here is the
// order of the checks once a caller is allowed in.
const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  canApiKeyReachSurveyResource: vi.fn(),
  getResponse: vi.fn(),
  getSurvey: vi.fn(),
  getWorkspaceLegacyStoragePrefixes: vi.fn(),
  sendToPipeline: vi.fn(),
  updateResponseWithQuotaEvaluation: vi.fn(),
  validateClientFileUploads: vi.fn(),
  validateResponseData: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: mocks.sendToPipeline }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/response/service", () => ({ getResponse: mocks.getResponse, deleteResponse: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/survey/visibility/api-key", () => ({
  RESPONSE_ACTION_FOR_METHOD: { GET: "read", PUT: "update", DELETE: "delete" },
  canApiKeyReachSurveyResource: mocks.canApiKeyReachSurveyResource,
}));
vi.mock("@/lib/workspace/service", () => ({
  getWorkspaceLegacyStoragePrefixes: mocks.getWorkspaceLegacyStoragePrefixes,
}));
vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: vi.fn((errors) => errors),
  validateResponseData: mocks.validateResponseData,
}));
vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((value) => value),
  validateClientFileUploads: mocks.validateClientFileUploads,
}));
vi.mock("./lib/response", () => ({
  updateResponseWithQuotaEvaluation: mocks.updateResponseWithQuotaEvaluation,
}));

const RESPONSE_ID = "clrs00000000000000000001";

const put = (body: unknown) =>
  (PUT as unknown as (input: unknown) => Promise<{ response: Response }>)({
    req: new Request(`http://localhost/api/v1/management/responses/${RESPONSE_ID}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    props: { params: Promise.resolve({ responseId: RESPONSE_ID }) },
    authentication: { apiKeyId: "key-1" },
  });

const keyed = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, "a"]));

describe("PUT /api/v1/management/responses/[responseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResponse.mockResolvedValue({ id: RESPONSE_ID, surveyId: "survey-1" });
    mocks.getSurvey.mockResolvedValue({ id: "survey-1", workspaceId: "ws-1", blocks: [], questions: [] });
    mocks.can.mockResolvedValue(true);
    mocks.canApiKeyReachSurveyResource.mockResolvedValue(true);
    mocks.getWorkspaceLegacyStoragePrefixes.mockResolvedValue([]);
    mocks.validateClientFileUploads.mockReturnValue(true);
    mocks.validateResponseData.mockReturnValue(null);
    mocks.updateResponseWithQuotaEvaluation.mockResolvedValue({ id: RESPONSE_ID });
  });

  test("refuses data past the key cap before the per-element validators walk it", async () => {
    const { response } = await put({ data: keyed(MAX_RESPONSE_DATA_KEYS + 1), finished: true });

    expect(response.status).toBe(400);
    expect(mocks.validateClientFileUploads).not.toHaveBeenCalled();
    expect(mocks.validateResponseData).not.toHaveBeenCalled();
    expect(mocks.updateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("validates and stores data at the cap", async () => {
    const { response } = await put({ data: keyed(MAX_RESPONSE_DATA_KEYS), finished: true });

    expect(response.status).toBe(200);
    expect(mocks.validateResponseData).toHaveBeenCalledOnce();
    expect(mocks.updateResponseWithQuotaEvaluation).toHaveBeenCalledOnce();
  });
});
