import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import { calculateTtcTotal } from "@/lib/response/utils";
import { captureTelemetry } from "@/lib/telemetry";
import { validateInputs } from "@/lib/utils/validate";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull, TSurveyQuota } from "@formbricks/types/quota";
import { TResponse } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { getContact } from "./contact";
import { createResponse, createResponseWithQuotaEvaluation } from "./response";

let mockIsFormbricksCloud = false;

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mockIsFormbricksCloud;
  },
  IS_PRODUCTION: false,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "mock-github-secret",
  GOOGLE_CLIENT_ID: "mock-google-client-id",
  GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  SAML_DATABASE_URL: "mock-saml-database-url",
  WEBAPP_URL: "mock-webapp-url",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
}));

vi.mock("@/lib/organization/service");
vi.mock("@/lib/posthogServer");
vi.mock("@/lib/response/utils");
vi.mock("@/lib/telemetry");
vi.mock("@/lib/utils/validate");
vi.mock("@/modules/ee/quotas/lib/evaluation-service");
vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      create: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger");
vi.mock("./contact");

const environmentId = "test-environment-id";
const surveyId = "test-survey-id";
const organizationId = "test-organization-id";
const responseId = "test-response-id";
const contactId = "test-contact-id";
const userId = "test-user-id";

const mockOrganization = {
  id: organizationId,
  name: "Test Org",
  billing: {
    limits: { monthly: { responses: 100 } },
    plan: "free",
  },
};

const mockContact: { id: string; attributes: TContactAttributes } = {
  id: contactId,
  attributes: { userId: userId, email: "test@example.com" },
};

const mockResponseInput: TResponseInputV2 = {
  environmentId,
  surveyId,
  contactId: null,
  displayId: null,
  finished: false,
  data: { question1: "answer1" },
  meta: { source: "web" },
  ttc: { question1: 1000 },
  singleUseId: null,
  language: "en",
  variables: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockResponsePrisma = {
  id: responseId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId,
  finished: false,
  data: { question1: "answer1" },
  meta: { source: "web" },
  ttc: { question1: 1000 },
  variables: {},
  contactAttributes: {},
  singleUseId: null,
  language: "en",
  displayId: null,
  tags: [],
};

const expectedResponse: TResponse = {
  ...mockResponsePrisma,
  contact: null,
  tags: [],
};

const mockQuota: TSurveyQuota = {
  id: "quota-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId,
  name: "Test Quota",
  limit: 100,
  logic: {
    connector: "and",
    conditions: [],
  },
  action: "endSurvey",
  endingCardId: "ending-card-id",
  countPartialSubmissions: false,
};

type MockTx = {
  response: {
    create: ReturnType<typeof vi.fn>;
  };
};
let mockTx: MockTx;

describe("createResponse V2", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockTx = {
      response: {
        create: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));

    vi.mocked(validateInputs).mockImplementation(() => {});
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as any);
    vi.mocked(getContact).mockResolvedValue(mockContact);
    vi.mocked(mockTx.response.create).mockResolvedValue(mockResponsePrisma as any);
    vi.mocked(calculateTtcTotal).mockImplementation((ttc) => ({
      ...ttc,
      _total: Object.values(ttc).reduce((a, b) => a + b, 0),
    }));
    vi.mocked(captureTelemetry).mockResolvedValue(undefined);
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(50);
    vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockResolvedValue(undefined);
    vi.mocked(evaluateResponseQuotas).mockResolvedValue({
      shouldEndSurvey: false,
      quotaFull: null,
    });
  });

  afterEach(() => {
    mockIsFormbricksCloud = false;
  });

  test("should check response limits if IS_FORMBRICKS_CLOUD is true", async () => {
    mockIsFormbricksCloud = true;
    await createResponse(mockResponseInput, mockTx);
    expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(organizationId);
    expect(sendPlanLimitsReachedEventToPosthogWeekly).not.toHaveBeenCalled();
  });

  test("should send limit reached event if IS_FORMBRICKS_CLOUD is true and limit reached", async () => {
    mockIsFormbricksCloud = true;
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(100);

    await createResponse(mockResponseInput, mockTx);

    expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(organizationId);
    expect(sendPlanLimitsReachedEventToPosthogWeekly).toHaveBeenCalledWith(environmentId, {
      plan: "free",
      limits: {
        projects: null,
        monthly: {
          responses: 100,
          miu: null,
        },
      },
    });
  });

  test("should throw ResourceNotFoundError if organization not found", async () => {
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);
    await expect(createResponse(mockResponseInput, mockTx)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2002",
      clientVersion: "test",
    });
    vi.mocked(mockTx.response.create).mockRejectedValue(prismaError);
    await expect(createResponse(mockResponseInput, mockTx)).rejects.toThrow(DatabaseError);
  });

  test("should throw original error on other errors", async () => {
    const genericError = new Error("Generic database error");
    vi.mocked(mockTx.response.create).mockRejectedValue(genericError);
    await expect(createResponse(mockResponseInput, mockTx)).rejects.toThrow(genericError);
  });

  test("should log error but not throw if sendPlanLimitsReachedEventToPosthogWeekly fails", async () => {
    mockIsFormbricksCloud = true;
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(100);
    const posthogError = new Error("PostHog error");
    vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockRejectedValue(posthogError);

    await createResponse(mockResponseInput, mockTx); // Should not throw

    expect(logger.error).toHaveBeenCalledWith(
      posthogError,
      "Error sending plan limits reached event to Posthog"
    );
  });

  test("should correctly map prisma tags to response tags", async () => {
    const mockTag: TTag = { id: "tag1", name: "Tag 1", environmentId };
    const prismaResponseWithTags = {
      ...mockResponsePrisma,
      tags: [{ tag: mockTag }],
    };

    vi.mocked(mockTx.response.create).mockResolvedValue(prismaResponseWithTags as any);

    const result = await createResponse(mockResponseInput, mockTx);
    expect(result.tags).toEqual([mockTag]);
  });
});

describe("createResponseWithQuotaEvaluation V2", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTx = {
      response: {
        create: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as any);
    vi.mocked(getContact).mockResolvedValue(mockContact);
    vi.mocked(mockTx.response.create).mockResolvedValue(mockResponsePrisma as any);
    vi.mocked(calculateTtcTotal).mockImplementation((ttc) => ({
      ...ttc,
      _total: Object.values(ttc).reduce((a, b) => a + b, 0),
    }));
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(50);
    vi.mocked(evaluateResponseQuotas).mockResolvedValue({
      shouldEndSurvey: false,
      quotaFull: null,
    });
  });

  test("should create response and return it without quotaFull when no quota is full", async () => {
    const result = await createResponseWithQuotaEvaluation(mockResponseInput);

    expect(result).toEqual(expectedResponse);
    expect(evaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponseInput.surveyId,
      responseId: expectedResponse.id,
      data: mockResponseInput.data,
      variables: mockResponseInput.variables,
      language: mockResponseInput.language,
      responseFinished: expectedResponse.finished,
      tx: mockTx,
    });
  });

  test("should include quotaFull in response when quota evaluation returns a full quota", async () => {
    vi.mocked(evaluateResponseQuotas).mockResolvedValue({
      shouldEndSurvey: false,
      quotaFull: mockQuota,
    });

    const result: TResponseWithQuotaFull = await createResponseWithQuotaEvaluation(mockResponseInput);

    expect(result).toEqual({
      ...expectedResponse,
      quotaFull: mockQuota,
    });
    expect(evaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponseInput.surveyId,
      responseId: expectedResponse.id,
      data: mockResponseInput.data,
      variables: mockResponseInput.variables,
      language: mockResponseInput.language,
      responseFinished: expectedResponse.finished,
      tx: mockTx,
    });
  });
});
