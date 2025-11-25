import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseInput } from "@formbricks/types/responses";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { createResponse, createResponseWithQuotaEvaluation } from "./response";

let mockIsFormbricksCloud = false;

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mockIsFormbricksCloud;
  },
  ENCRYPTION_KEY: "test",
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/response/utils", () => ({
  calculateTtcTotal: vi.fn((ttc) => ttc),
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("./contact", () => ({
  getContactByUserId: vi.fn(),
}));

vi.mock("@/modules/ee/quotas/lib/evaluation-service", () => ({
  evaluateResponseQuotas: vi.fn(),
}));

const environmentId = "test-environment-id";
const surveyId = "test-survey-id";
const organizationId = "test-organization-id";
const responseId = "test-response-id";

const mockOrganization = {
  id: organizationId,
  name: "Test Org",
  billing: {
    limits: { monthly: { responses: 100 } },
    plan: "free",
  },
};

const mockResponseInput: TResponseInput = {
  environmentId,
  surveyId,
  userId: null,
  finished: false,
  data: { question1: "answer1" },
  meta: { source: "web" },
  ttc: { question1: 1000 },
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
  language: null,
  displayId: null,
  tags: [],
};

type MockTx = {
  response: {
    create: ReturnType<typeof vi.fn>;
  };
};
let mockTx: MockTx;

describe("createResponse", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as any);
    vi.mocked(prisma.response.create).mockResolvedValue(mockResponsePrisma as any);
    vi.mocked(calculateTtcTotal).mockImplementation((ttc) => ttc);
  });

  afterEach(() => {
    mockIsFormbricksCloud = false;
  });

  test("should handle finished response and calculate TTC", async () => {
    const finishedInput = { ...mockResponseInput, finished: true };
    await createResponse(finishedInput);
    expect(calculateTtcTotal).toHaveBeenCalledWith(mockResponseInput.ttc);
    expect(prisma.response.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ finished: true }),
      })
    );
  });

  test("should throw ResourceNotFoundError if organization not found", async () => {
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);
    await expect(createResponse(mockResponseInput, prisma)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2002",
      clientVersion: "test",
    });
    vi.mocked(prisma.response.create).mockRejectedValue(prismaError);
    await expect(createResponse(mockResponseInput)).rejects.toThrow(DatabaseError);
  });

  test("should throw original error on other Prisma errors", async () => {
    const genericError = new Error("Generic database error");
    vi.mocked(prisma.response.create).mockRejectedValue(genericError);
    await expect(createResponse(mockResponseInput)).rejects.toThrow(genericError);
  });
});

describe("createResponseWithQuotaEvaluation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTx = {
      response: {
        create: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as any);
    vi.mocked(mockTx.response.create).mockResolvedValue(mockResponsePrisma as any);
    vi.mocked(calculateTtcTotal).mockImplementation((ttc) => ttc);
  });

  afterEach(() => {
    mockIsFormbricksCloud = false;
  });

  test("should return response without quotaFull when no quota violations", async () => {
    // Mock quota evaluation to return no violations
    vi.mocked(evaluateResponseQuotas).mockResolvedValue({
      shouldEndSurvey: false,
      quotaFull: undefined,
    });

    const result = await createResponseWithQuotaEvaluation(mockResponseInput, mockTx);

    expect(evaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponseInput.surveyId,
      responseId: responseId,
      data: mockResponseInput.data,
      variables: mockResponseInput.variables,
      language: mockResponseInput.language,
      responseFinished: mockResponseInput.finished,
      tx: mockTx,
    });

    expect(result).toEqual({
      id: responseId,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      surveyId,
      finished: false,
      data: { question1: "answer1" },
      meta: { source: "web" },
      ttc: { question1: 1000 },
      variables: {},
      contactAttributes: {},
      singleUseId: null,
      language: null,
      displayId: null,
      contact: null,
      tags: [],
    });
    expect(result).not.toHaveProperty("quotaFull");
  });

  test("should return response with quotaFull when quota is exceeded with endSurvey action", async () => {
    const mockQuotaFull: TSurveyQuota = {
      id: "quota-123",
      name: "Test Quota",
      limit: 100,
      action: "endSurvey",
      endingCardId: "ending-123",
      surveyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      logic: {
        connector: "and",
        conditions: [],
      },
      countPartialSubmissions: true,
    };

    vi.mocked(evaluateResponseQuotas).mockResolvedValue({
      shouldEndSurvey: true,
      quotaFull: mockQuotaFull,
    });

    const result = await createResponseWithQuotaEvaluation(mockResponseInput, mockTx);

    expect(evaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponseInput.surveyId,
      responseId: responseId,
      data: mockResponseInput.data,
      variables: mockResponseInput.variables,
      language: mockResponseInput.language,
      responseFinished: mockResponseInput.finished,
      tx: mockTx,
    });

    expect(result).toEqual({
      id: responseId,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      surveyId,
      finished: false,
      data: { question1: "answer1" },
      meta: { source: "web" },
      ttc: { question1: 1000 },
      variables: {},
      contactAttributes: {},
      singleUseId: null,
      language: null,
      displayId: null,
      contact: null,
      tags: [],
      quotaFull: mockQuotaFull,
    });
  });

  test("should return response with quotaFull when quota is exceeded with continueSurvey action", async () => {
    const mockQuotaFull: TSurveyQuota = {
      id: "quota-456",
      name: "Continue Test Quota",
      limit: 50,
      action: "continueSurvey",
      endingCardId: null,
      surveyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      logic: {
        connector: "or",
        conditions: [],
      },
      countPartialSubmissions: false,
    };

    vi.mocked(evaluateResponseQuotas).mockResolvedValue({
      shouldEndSurvey: false,
      quotaFull: mockQuotaFull,
    });

    const result = await createResponseWithQuotaEvaluation(mockResponseInput, mockTx);

    expect(result).toEqual({
      id: responseId,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      surveyId,
      finished: false,
      data: { question1: "answer1" },
      meta: { source: "web" },
      ttc: { question1: 1000 },
      variables: {},
      contactAttributes: {},
      singleUseId: null,
      language: null,
      displayId: null,
      contact: null,
      tags: [],
      quotaFull: mockQuotaFull,
    });
  });
});
