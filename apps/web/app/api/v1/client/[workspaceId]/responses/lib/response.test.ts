import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UniqueConstraintError,
} from "@formbricks/types/errors";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseInput } from "@formbricks/types/responses";
import { getOrganization } from "@/lib/organization/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import {
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
} from "@/modules/ee/quotas/lib/evaluation-service";
import { getContactByUserId } from "./contact";
import { createResponse, createResponseWithQuotaEvaluation, resolveCreateResponseContext } from "./response";

vi.mock("server-only", () => ({}));

let mockIsFormbricksCloud = false;

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mockIsFormbricksCloud;
  },
  ENCRYPTION_KEY: "test",
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/response/utils", async (importOriginal) => ({
  // keep the real normalizeResponseLanguage; calculateTtcTotal stays mockable (tests configure it)
  ...(await importOriginal<typeof import("@/lib/response/utils")>()),
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
  loadQuotaEvaluationContext: vi.fn(),
}));

const workspaceId = "test-workspace-id";
const surveyId = "test-survey-id";
const organizationId = "test-organization-id";
const responseId = "test-response-id";

const mockOrganization = {
  id: organizationId,
  name: "Test Org",
  billing: {
    limits: { monthly: { responses: 100 } },
  },
};

const mockResponseInput: TResponseInput = {
  workspaceId,
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

const noContact = { contact: null };

type TResolvedContact = { id: string; attributes: TContactAttributes };
type TOrganizationResult = Awaited<ReturnType<typeof getOrganization>>;

type MockTx = {
  response: {
    create: ReturnType<typeof vi.fn>;
  };
};
let mockTx: MockTx;

describe("createResponse", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(organizationId);
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization as any);
    vi.mocked(prisma.response.create).mockResolvedValue(mockResponsePrisma as any);
    vi.mocked(calculateTtcTotal).mockImplementation((ttc) => ttc);
  });

  afterEach(() => {
    mockIsFormbricksCloud = false;
  });

  test("should handle finished response and calculate TTC", async () => {
    const finishedInput = { ...mockResponseInput, finished: true };
    await createResponse(finishedInput, noContact, prisma);
    expect(calculateTtcTotal).toHaveBeenCalledWith(mockResponseInput.ttc);
    expect(prisma.response.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ finished: true }),
      })
    );
  });

  test("should persist endingId when provided", async () => {
    await createResponse(
      { ...mockResponseInput, finished: true, endingId: "ending-card-id" },
      noContact,
      prisma
    );
    expect(prisma.response.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ finished: true, endingId: "ending-card-id" }),
      })
    );
  });

  test("should default endingId to null when not provided", async () => {
    await createResponse(mockResponseInput, noContact, prisma);
    expect(prisma.response.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ endingId: null }),
      })
    );
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2025",
      clientVersion: "test",
    });
    vi.mocked(prisma.response.create).mockRejectedValue(prismaError);
    await expect(createResponse(mockResponseInput, noContact, prisma)).rejects.toThrow(DatabaseError);
  });

  test("should throw UniqueConstraintError on P2002 with singleUseId target", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { driverAdapterError: { cause: { constraint: { fields: ["surveyId", "singleUseId"] } } } },
    });
    vi.mocked(prisma.response.create).mockRejectedValue(prismaError);
    await expect(createResponse(mockResponseInput, noContact, prisma)).rejects.toThrow(UniqueConstraintError);
  });

  test("should throw InvalidInputError on P2002 with displayId target (race condition)", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { driverAdapterError: { cause: { constraint: { fields: ["displayId"] } } } },
    });
    vi.mocked(prisma.response.create).mockRejectedValue(prismaError);
    await expect(createResponse(mockResponseInput, noContact, prisma)).rejects.toThrow(InvalidInputError);
  });

  test("should throw original error on other Prisma errors", async () => {
    const genericError = new Error("Generic database error");
    vi.mocked(prisma.response.create).mockRejectedValue(genericError);
    await expect(createResponse(mockResponseInput, noContact, prisma)).rejects.toThrow(genericError);
  });
});

describe("resolveCreateResponseContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(organizationId);
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization as TOrganizationResult);
  });

  test("throws ResourceNotFoundError if the organization is not found", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);
    await expect(resolveCreateResponseContext(mockResponseInput)).rejects.toThrow(ResourceNotFoundError);
  });

  test("resolves the contact by userId when one is given", async () => {
    const contact: TResolvedContact = { id: "contact-id", attributes: { userId: "user-1" } };
    vi.mocked(getContactByUserId).mockResolvedValue(contact);

    await expect(resolveCreateResponseContext({ workspaceId, userId: "user-1" })).resolves.toEqual({
      contact,
    });
    expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, "user-1");
  });

  test("resolves no contact and skips the lookup without a userId", async () => {
    await expect(resolveCreateResponseContext(mockResponseInput)).resolves.toEqual({ contact: null });
    expect(getContactByUserId).not.toHaveBeenCalled();
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
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(organizationId);
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization as any);
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

    const result = await createResponseWithQuotaEvaluation(mockResponseInput);

    expect(evaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponseInput.surveyId,
      responseId: responseId,
      data: mockResponseInput.data,
      variables: mockResponseInput.variables,
      language: undefined, // null language is normalized to undefined for quota evaluation
      responseFinished: mockResponseInput.finished,
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response: expect.objectContaining({ id: responseId }),
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

    const result = await createResponseWithQuotaEvaluation(mockResponseInput);

    expect(evaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponseInput.surveyId,
      responseId: responseId,
      data: mockResponseInput.data,
      variables: mockResponseInput.variables,
      language: undefined, // null language is normalized to undefined for quota evaluation
      responseFinished: mockResponseInput.finished,
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response: expect.objectContaining({ id: responseId }),
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

    const result = await createResponseWithQuotaEvaluation(mockResponseInput);

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

  test("should reuse a caller-supplied transaction instead of opening its own", async () => {
    // A caller that persists a response as part of a larger all-or-nothing write passes its own
    // transaction. Opening a second one here would commit the response independently, so the caller's
    // rollback would leave it behind.
    const callerTx: MockTx = { response: { create: vi.fn() } };
    callerTx.response.create.mockResolvedValue(mockResponsePrisma);
    vi.mocked(evaluateResponseQuotas).mockResolvedValue({
      shouldEndSurvey: false,
      quotaFull: undefined,
    });

    const quotaContext = { quotas: [], survey: { id: surveyId } } as unknown as Awaited<
      ReturnType<typeof loadQuotaEvaluationContext>
    >;

    const result = await createResponseWithQuotaEvaluation(
      mockResponseInput,
      // No ingest flags on this path; the transaction and the quota context it was opened after come
      // in as the fourth argument.
      undefined,
      { tx: callerTx as unknown as Prisma.TransactionClient, quotaContext, responseContext: noContact }
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(callerTx.response.create).toHaveBeenCalled();
    expect(mockTx.response.create).not.toHaveBeenCalled();
    // The caller read both contexts before its transaction, so nothing is read here.
    expect(loadQuotaEvaluationContext).not.toHaveBeenCalled();
    expect(getOrganizationIdFromWorkspaceId).not.toHaveBeenCalled();
    expect(getOrganization).not.toHaveBeenCalled();
    expect(evaluateResponseQuotas).toHaveBeenCalledWith(
      expect.objectContaining({ tx: callerTx, quotaContext })
    );
    expect(result.id).toBe(responseId);
  });

  test("reads the organization and contact before opening its own transaction, not inside it (ENG-3285)", async () => {
    const contact: TResolvedContact = { id: "contact-id", attributes: { userId: "user-1" } };
    vi.mocked(getContactByUserId).mockResolvedValue(contact);
    mockTx.response.create.mockResolvedValue(mockResponsePrisma);
    vi.mocked(evaluateResponseQuotas).mockResolvedValue({ shouldEndSurvey: false, quotaFull: undefined });

    const result = await createResponseWithQuotaEvaluation({ ...mockResponseInput, userId: "user-1" });

    const transactionOpenedAt = vi.mocked(prisma.$transaction).mock.invocationCallOrder[0];
    for (const read of [getOrganizationIdFromWorkspaceId, getOrganization, getContactByUserId]) {
      expect(vi.mocked(read).mock.invocationCallOrder[0]).toBeLessThan(transactionOpenedAt);
    }
    // The contact read outside still reaches the row written inside.
    expect(mockTx.response.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contact: { connect: { id: contact.id } } }),
      })
    );
    expect(result.contact).toEqual({ id: contact.id, userId: "user-1" });
  });

  test("reads the quota definitions before opening its own transaction, not inside it (ENG-3285)", async () => {
    const quotaContext = { quotas: [], survey: { id: surveyId } } as unknown as Awaited<
      ReturnType<typeof loadQuotaEvaluationContext>
    >;
    vi.mocked(loadQuotaEvaluationContext).mockResolvedValue(quotaContext);
    mockTx.response.create.mockResolvedValue(mockResponsePrisma);
    vi.mocked(evaluateResponseQuotas).mockResolvedValue({ shouldEndSurvey: false, quotaFull: undefined });

    await createResponseWithQuotaEvaluation(mockResponseInput);

    expect(loadQuotaEvaluationContext).toHaveBeenCalledWith(mockResponseInput.surveyId);
    expect(vi.mocked(loadQuotaEvaluationContext).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(prisma.$transaction).mock.invocationCallOrder[0]
    );
    // Evaluated against the survey of the row actually written, not the request's claim.
    expect(evaluateResponseQuotas).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: mockResponsePrisma.surveyId, quotaContext })
    );
  });
});
