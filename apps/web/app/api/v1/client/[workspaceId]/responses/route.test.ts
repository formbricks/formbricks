import { beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_INGESTED_VALUE_BYTES } from "@formbricks/types/embedded-data-ingest";
import { POST } from "./route";

/**
 * The v1 sibling of the v2 POST boundary test. Both versions are live and each has its own handler,
 * so a contract wired into one and not the other would leave a public endpoint through which a
 * crafted body still writes whatever it likes into `response.data`.
 *
 * `withV1ApiWrapper` is reduced to its handler: everything it adds — auth, rate limiting, audit
 * logging — is orthogonal to what is being proved here, and mocking it away is what keeps this test
 * about the contract.
 */
const mocks = vi.hoisted(() => ({
  applyIPRateLimit: vi.fn(),
  createQuotaFullObject: vi.fn(),
  createResponseWithQuotaEvaluation: vi.fn(),
  enforceVerifiedEmailGate: vi.fn(),
  formatValidationErrorsForV1Api: vi.fn((errors) => errors),
  getClientIpFromHeaders: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getSurvey: vi.fn(),
  resolveClientApiIds: vi.fn(),
  sendToPipeline: vi.fn(),
  validateClientFileUploads: vi.fn(),
  validateResponseData: vi.fn(),
  validateSingleUseResponseInput: vi.fn(),
  verifyLinkSurveyPinToken: vi.fn(),
  verifyResponseRecaptcha: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/app/api/client/[workspaceId]/responses/lib/single-use", () => ({
  validateSingleUseResponseInput: mocks.validateSingleUseResponseInput,
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

vi.mock("@/modules/api/lib/verify-response-recaptcha", () => ({
  verifyResponseRecaptcha: mocks.verifyResponseRecaptcha,
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

vi.mock("@/modules/survey/link/lib/pin-token", () => ({
  verifyLinkSurveyPinToken: mocks.verifyLinkSurveyPinToken,
}));

vi.mock("@/modules/survey/link/lib/verify-email-gate", () => ({
  enforceVerifiedEmailGate: mocks.enforceVerifiedEmailGate,
  VERIFIED_EMAIL_RESPONSE_KEY: "verifiedEmail",
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: mocks.createResponseWithQuotaEvaluation,
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
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

const postRawBody = async (data: Record<string, unknown>) => {
  const req = new Request(`https://api.test/api/v1/client/${workspaceId}/responses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ surveyId, finished: false, data }),
  });

  return (POST as unknown as (params: unknown) => Promise<{ response: Response }>)({
    req,
    props: { params: Promise.resolve({ workspaceId }) },
  });
};

const persisted = () => {
  const [responseInput, ingestFlags] = mocks.createResponseWithQuotaEvaluation.mock.calls[0];
  return { data: responseInput.data, ingestFlags };
};

describe("POST /api/v1/client/[workspaceId]/responses — Embedded Data ingest contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId });
    mocks.getSurvey.mockResolvedValue(getSurveyWithFields([]));
    mocks.verifyLinkSurveyPinToken.mockReturnValue(true);
    mocks.enforceVerifiedEmailGate.mockReturnValue(null);
    mocks.verifyResponseRecaptcha.mockResolvedValue(null);
    mocks.validateSingleUseResponseInput.mockReturnValue(undefined);
    mocks.validateClientFileUploads.mockReturnValue(true);
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

    const result = await postRawBody({ q1: "answer", plan: "gold", rogue: "injected" });

    expect(result.response.status).toBe(200);
    expect(persisted().data).toEqual({ q1: "answer", plan: "gold" });
  });

  test("drops a locked field's key", async () => {
    mocks.getSurvey.mockResolvedValue(
      getSurveyWithFields([ingestedField({ storageKey: "plan", locked: true })])
    );

    const result = await postRawBody({ plan: "gold" });

    expect(result.response.status).toBe(200);
    expect(persisted().data).toEqual({});
  });

  test("truncates an oversize value and records the flag", async () => {
    mocks.getSurvey.mockResolvedValue(getSurveyWithFields([ingestedField({ storageKey: "note" })]));

    const result = await postRawBody({ note: "a".repeat(MAX_INGESTED_VALUE_BYTES + 500) });

    expect(result.response.status).toBe(200);
    expect(persisted().data.note as string).toHaveLength(MAX_INGESTED_VALUE_BYTES);
    expect(persisted().ingestFlags).toEqual([{ key: "note", reason: "truncated" }]);
  });

  /**
   * The ordering the route depends on: `verifiedEmail` is a forbidden field name, so no survey can
   * declare it and the contract would drop it. The gate therefore has to write it *after* the
   * contract has run — if the two are ever swapped, email verification silently stops recording an
   * address.
   */
  test("leaves the verified-email gate as the last writer of response data", async () => {
    mocks.getSurvey.mockResolvedValue(getSurveyWithFields([ingestedField({ storageKey: "plan" })]));
    mocks.enforceVerifiedEmailGate.mockImplementation(
      ({ responseData }: { responseData: Record<string, unknown> }) => {
        responseData.verifiedEmail = "someone@example.com";
        return null;
      }
    );

    await postRawBody({ plan: "gold" });

    expect(persisted().data).toEqual({ plan: "gold", verifiedEmail: "someone@example.com" });
  });
});
