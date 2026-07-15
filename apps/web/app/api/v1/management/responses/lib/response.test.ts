import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma, Response as ResponsePrisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse, TResponseInput } from "@formbricks/types/responses";
import { getResponseContact } from "@/lib/response/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { validateInputs } from "@/lib/utils/validate";
import { getContactByUserId } from "./contact";
import { createResponse, getResponsesByWorkspaceIds } from "./response";

// Mock Data
const workspaceId = "test-workspace-id";
const mockUserId = "test-user-id";
const surveyId = "test-survey-id";
const displayId = "test-display-id";
const responseId = "test-response-id";

const mockOrganization = "test-organization-id";

const mockResponseInput: TResponseInput = {
  workspaceId,
  surveyId,
  displayId,
  finished: true,
  data: { q1: "answer1" },
  meta: { userAgent: { browser: "test-browser" } },
  ttc: { q1: 5 },
  language: "en",
};

const mockResponseInputWithUserId: TResponseInput = {
  ...mockResponseInput,
  userId: mockUserId,
};

// Prisma response structure (simplified)
const mockResponsePrisma = {
  id: responseId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId,
  finished: true,
  endingId: null,
  data: { q1: "answer1" },
  meta: { userAgent: { browser: "test-browser" } },
  ttc: { q1: 5, total: 10 }, // Assume calculateTtcTotal adds 'total'
  variables: {},
  contactAttributes: {},
  singleUseId: null,
  language: "en",
  displayId,
  contact: null, // Prisma relation
  tags: [], // Prisma relation
} as unknown as ResponsePrisma & { contact: any; tags: any[] }; // Adjust type as needed

const mockResponse: TResponse = {
  id: responseId,
  createdAt: mockResponsePrisma.createdAt,
  updatedAt: mockResponsePrisma.updatedAt,
  surveyId,
  finished: true,
  endingId: null,
  data: { q1: "answer1" },
  meta: { userAgent: { browser: "test-browser" } },
  ttc: { q1: 5, total: 10 },
  variables: {},
  contactAttributes: {},
  singleUseId: null,
  language: "en",
  displayId,
  contact: null, // Transformed structure
  tags: [], // Transformed structure
};

const mockWorkspaceIds = ["workspace-1", "workspace-2"];
const mockLimit = 10;
const mockOffset = 5;

const mockResponsesPrisma = [mockResponsePrisma, { ...mockResponsePrisma, id: "response-2" }];
const mockTransformedResponses = [mockResponse, { ...mockResponse, id: "response-2" }];

// Mock dependencies
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
  POSTHOG_KEY: undefined,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  STRIPE_API_VERSION: "2026-01-28.clover",
  IS_PRODUCTION: false,
  SENTRY_DSN: "mock-sentry-dsn",
}));
vi.mock("@/lib/utils/helper");
vi.mock("@/lib/response/service");
vi.mock("@/lib/response/utils");
vi.mock("@/lib/utils/validate");
vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger");
vi.mock("./contact");

type MockTx = {
  response: {
    create: ReturnType<typeof vi.fn>;
  };
};
let mockTx: MockTx;

describe("Response Lib Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      response: {
        create: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));
  });

  describe("createResponse", () => {
    test("should create a response successfully with userId", async () => {
      const mockContact = { id: "contact1", attributes: { userId: mockUserId } };
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(mockOrganization);
      vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
      vi.mocked(calculateTtcTotal).mockReturnValue({ total: 10 });
      vi.mocked(mockTx.response.create).mockResolvedValue({
        ...mockResponsePrisma,
      });

      const response = await createResponse(
        mockResponseInputWithUserId,
        mockTx as unknown as Prisma.TransactionClient
      );

      expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith(workspaceId);
      expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, mockUserId);
      expect(mockTx.response.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contact: { connect: { id: mockContact.id } },
            contactAttributes: mockContact.attributes,
          }),
        })
      );
      expect(response.contact).toEqual({ id: mockContact.id, userId: mockUserId });
    });

    test("should throw ResourceNotFoundError if organization not found", async () => {
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(null as unknown as string);
      await expect(
        createResponse(mockResponseInput, mockTx as unknown as Prisma.TransactionClient)
      ).rejects.toThrow(ResourceNotFoundError);
      expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith(workspaceId);
      expect(mockTx.response.create).not.toHaveBeenCalled();
    });

    test("should handle PrismaClientKnownRequestError", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P2002",
        clientVersion: "2.0",
      });
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(mockOrganization);
      vi.mocked(mockTx.response.create).mockRejectedValue(prismaError);

      await expect(
        createResponse(mockResponseInput, mockTx as unknown as Prisma.TransactionClient)
      ).rejects.toThrow(DatabaseError);
      expect(logger.error).not.toHaveBeenCalled(); // Should be caught and re-thrown as DatabaseError
    });

    test("should handle RecordNotFound error with specific message", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Related record does not exist", {
        code: "P2025", // PrismaErrorType.RecordNotFound
        clientVersion: "2.0",
      });
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(mockOrganization);
      vi.mocked(mockTx.response.create).mockRejectedValue(prismaError);

      await expect(
        createResponse(mockResponseInput, mockTx as unknown as Prisma.TransactionClient)
      ).rejects.toThrow(DatabaseError);
      await expect(
        createResponse(mockResponseInput, mockTx as unknown as Prisma.TransactionClient)
      ).rejects.toThrow("Display ID does not exist");
    });

    test("should handle generic errors", async () => {
      const genericError = new Error("Something went wrong");
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(mockOrganization);
      vi.mocked(mockTx.response.create).mockRejectedValue(genericError);

      await expect(
        createResponse(mockResponseInput, mockTx as unknown as Prisma.TransactionClient)
      ).rejects.toThrow(genericError);
    });
  });

  describe("getResponsesByWorkspaceIds", () => {
    test("should return responses successfully", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue(mockResponsesPrisma);
      vi.mocked(getResponseContact).mockReturnValue(null); // Assume no contact for simplicity

      const responses = await getResponsesByWorkspaceIds(mockWorkspaceIds);

      expect(validateInputs).toHaveBeenCalledTimes(1);
      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            survey: {
              workspaceId: { in: mockWorkspaceIds },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: undefined,
          skip: undefined,
        })
      );
      expect(getResponseContact).toHaveBeenCalledTimes(mockResponsesPrisma.length);
      expect(responses).toEqual(mockTransformedResponses);
    });

    test("should return responses with limit and offset", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue(mockResponsesPrisma);
      vi.mocked(getResponseContact).mockReturnValue(null);

      await getResponsesByWorkspaceIds(mockWorkspaceIds, mockLimit, mockOffset);

      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: mockLimit,
          skip: mockOffset,
        })
      );
    });

    test("should return empty array if no responses found", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue([]);

      const responses = await getResponsesByWorkspaceIds(mockWorkspaceIds);

      expect(responses).toEqual([]);
      expect(prisma.response.findMany).toHaveBeenCalled();
      expect(getResponseContact).not.toHaveBeenCalled();
    });

    test("should handle PrismaClientKnownRequestError", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P2002",
        clientVersion: "2.0",
      });
      vi.mocked(prisma.response.findMany).mockRejectedValue(prismaError);

      await expect(getResponsesByWorkspaceIds(mockWorkspaceIds)).rejects.toThrow(DatabaseError);
    });

    test("should handle generic errors", async () => {
      const genericError = new Error("Something went wrong");
      vi.mocked(prisma.response.findMany).mockRejectedValue(genericError);

      await expect(getResponsesByWorkspaceIds(mockWorkspaceIds)).rejects.toThrow(genericError);
    });
  });
});
