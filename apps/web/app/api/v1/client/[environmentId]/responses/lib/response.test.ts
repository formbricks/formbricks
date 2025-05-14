import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import { calculateTtcTotal } from "@/lib/response/utils";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseInput } from "@formbricks/types/responses";
import { createResponse } from "./response";

let mockIsFormbricksCloud = false;

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mockIsFormbricksCloud;
  },
}));

vi.mock("@/lib/organization/service", () => ({
  getMonthlyOrganizationResponseCount: vi.fn(),
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/posthogServer", () => ({
  sendPlanLimitsReachedEventToPosthogWeekly: vi.fn(),
}));

vi.mock("@/lib/response/cache", () => ({
  responseCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/response/utils", () => ({
  calculateTtcTotal: vi.fn((ttc) => ttc),
}));

vi.mock("@/lib/responseNote/cache", () => ({
  responseNoteCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/telemetry", () => ({
  captureTelemetry: vi.fn(),
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      create: vi.fn(),
    },
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
  notes: [],
};

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

  test("should check response limits if IS_FORMBRICKS_CLOUD is true", async () => {
    mockIsFormbricksCloud = true;
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(50);

    await createResponse(mockResponseInput);

    expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(organizationId);
    expect(sendPlanLimitsReachedEventToPosthogWeekly).not.toHaveBeenCalled();
  });

  test("should send limit reached event if IS_FORMBRICKS_CLOUD is true and limit reached", async () => {
    mockIsFormbricksCloud = true;
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(100);

    await createResponse(mockResponseInput);

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
    await expect(createResponse(mockResponseInput)).rejects.toThrow(ResourceNotFoundError);
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

  test("should log error but not throw if sendPlanLimitsReachedEventToPosthogWeekly fails", async () => {
    mockIsFormbricksCloud = true;
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(100);
    const posthogError = new Error("PostHog error");
    vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockRejectedValue(posthogError);

    await createResponse(mockResponseInput);

    expect(logger.error).toHaveBeenCalledWith(
      posthogError,
      "Error sending plan limits reached event to Posthog"
    );
  });
});
