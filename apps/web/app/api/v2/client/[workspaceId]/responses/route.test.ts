import { beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_INGESTED_VALUE_BYTES } from "@formbricks/types/embedded-data-ingest";
import { POST } from "./route";

/**
 * Covers the ingest contract at the POST boundary **by crafting the request body**, which is the
 * only way to prove the AC's "server-side re-validation … that bypasses the client filter": the
 * renderer applies the same contract, so a test that goes through it proves nothing about what an
 * attacker posting straight at this endpoint can write.
 *
 * Everything around the contract is mocked; the contract itself, and `getElementsFromBlocks` under
 * it, run for real.
 */
const mocks = vi.hoisted(() => ({
  checkSurveyValidity: vi.fn(),
  createQuotaFullObject: vi.fn(),
  createResponseWithQuotaEvaluation: vi.fn(),
  formatValidationErrorsForV1Api: vi.fn((errors) => errors),
  getClientIpFromHeaders: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getSurvey: vi.fn(),
  reportApiError: vi.fn(),
  resolveClientApiIds: vi.fn(),
  sendToPipeline: vi.fn(),
  validateClientFileUploads: vi.fn(),
  validateOtherOptionLengthForMultipleChoice: vi.fn(),
  validateResponseData: vi.fn(),
}));

vi.mock("@/app/api/v2/client/[workspaceId]/responses/lib/utils", () => ({
  checkSurveyValidity: mocks.checkSurveyValidity,
}));

vi.mock("@/app/lib/api/api-error-reporter", () => ({
  reportApiError: mocks.reportApiError,
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: mocks.sendToPipeline,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mocks.getSurvey,
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: mocks.resolveClientApiIds,
}));

vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: mocks.formatValidationErrorsForV1Api,
  validateResponseData: mocks.validateResponseData,
}));

vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: mocks.validateOtherOptionLengthForMultipleChoice,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

vi.mock("@/modules/ee/quotas/lib/helpers", () => ({
  createQuotaFullObject: mocks.createQuotaFullObject,
}));

vi.mock("@/modules/storage/utils", () => ({
  validateClientFileUploads: mocks.validateClientFileUploads,
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: mocks.createResponseWithQuotaEvaluation,
}));

const workspaceId = "lygo31gfsexlr4lh6rq8dxyl";
const surveyId = "cgt5e6dw1vsf1bv2ki5gj845";
const responseId = "c9471238d6c542b4bd1300e4";

const ingestedField = ({
  storageKey,
  dataType = "string",
  locked = false,
}: {
  storageKey: string;
  dataType?: string;
  locked?: boolean;
}) => ({
  field: { name: storageKey, source: "ingested", dataType, defaultValue: null, locked },
  link: { storageKey },
});

// `q1` is a real element, so an answer under that key is a question answer rather than an ingested value.
const getSurveyWithFields = (embeddedFields: unknown[]) => ({
  id: surveyId,
  workspaceId,
  status: "inProgress",
  blocks: [{ id: "block_1", elements: [{ id: "q1" }] }],
  questions: [],
  embeddedFields,
  isCaptureIpEnabled: false,
  isAnonymizeResponsesEnabled: false,
});

/** Posts a raw body straight at the endpoint, as a caller that never ran the renderer would. */
const postRawBody = async (data: Record<string, unknown>): Promise<Response> => {
  const request = new Request(`https://api.test/api/v2/client/${workspaceId}/responses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ surveyId, finished: false, data }),
  });

  return POST(request, { params: Promise.resolve({ workspaceId }) });
};

/** What the route actually persisted, and the flags it computed for it. */
const persisted = () => {
  const [responseInput, ingestFlags] = mocks.createResponseWithQuotaEvaluation.mock.calls[0];
  return { data: responseInput.data, ingestFlags };
};

describe("POST /api/v2/client/[workspaceId]/responses — Embedded Data ingest contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId });
    mocks.getSurvey.mockResolvedValue(getSurveyWithFields([]));
    mocks.checkSurveyValidity.mockResolvedValue(null);
    mocks.validateClientFileUploads.mockReturnValue(true);
    mocks.validateOtherOptionLengthForMultipleChoice.mockReturnValue(null);
    mocks.validateResponseData.mockReturnValue(null);
    mocks.createQuotaFullObject.mockReturnValue({});
    mocks.createResponseWithQuotaEvaluation.mockResolvedValue({
      id: responseId,
      surveyId,
      finished: false,
      quotaFull: undefined,
    });
  });

  test("drops a key no ingested field declares", async () => {
    mocks.getSurvey.mockResolvedValue(getSurveyWithFields([ingestedField({ storageKey: "plan" })]));

    const response = await postRawBody({ q1: "answer", plan: "gold", rogue: "injected" });

    expect(response.status).toBe(200);
    expect(persisted().data).toEqual({ q1: "answer", plan: "gold" });
  });

  test("drops a locked field's key", async () => {
    mocks.getSurvey.mockResolvedValue(
      getSurveyWithFields([ingestedField({ storageKey: "plan", locked: true })])
    );

    const response = await postRawBody({ plan: "gold" });

    expect(response.status).toBe(200);
    expect(persisted().data).toEqual({});
  });

  test("truncates an oversize value and records the flag", async () => {
    mocks.getSurvey.mockResolvedValue(getSurveyWithFields([ingestedField({ storageKey: "note" })]));

    const response = await postRawBody({ note: "a".repeat(MAX_INGESTED_VALUE_BYTES + 500) });

    expect(response.status).toBe(200);
    expect((persisted().data.note as string).length).toBe(MAX_INGESTED_VALUE_BYTES);
    expect(persisted().ingestFlags).toEqual([{ key: "note", reason: "truncated" }]);
  });

  test("stores a wrong-typed value raw, flags it, and still creates the response", async () => {
    mocks.getSurvey.mockResolvedValue(
      getSurveyWithFields([ingestedField({ storageKey: "seats", dataType: "number" })])
    );

    const response = await postRawBody({ seats: "many" });

    expect(response.status).toBe(200);
    expect(persisted().data).toEqual({ seats: "many" });
    expect(persisted().ingestFlags).toEqual([{ key: "seats", reason: "coercion_failed" }]);
  });

  test("coerces a declared value before validation and quota evaluation see it", async () => {
    mocks.getSurvey.mockResolvedValue(
      getSurveyWithFields([ingestedField({ storageKey: "seats", dataType: "number" })])
    );

    await postRawBody({ seats: "12" });

    expect(persisted().data).toEqual({ seats: 12 });
    // Both read the same object the contract replaced, so neither can act on the raw value.
    expect(mocks.validateResponseData).toHaveBeenCalledWith(
      expect.anything(),
      { seats: 12 },
      expect.anything(),
      expect.anything()
    );
    expect(mocks.checkSurveyValidity).toHaveBeenCalledWith(
      expect.anything(),
      workspaceId,
      expect.objectContaining({ data: { seats: 12 } })
    );
  });
});
