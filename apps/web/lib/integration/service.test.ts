import { IntegrationType, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TIntegrationInput } from "@formbricks/types/integration";
import { getEnvironmentIdFromWorkspaceId } from "@/lib/utils/helper";
import { ITEMS_PER_PAGE } from "../constants";
import {
  createOrUpdateIntegration,
  deleteIntegration,
  getIntegration,
  getIntegrationByType,
  getIntegrations,
} from "./service";

vi.mock("@/lib/utils/helper", () => ({
  getEnvironmentIdFromWorkspaceId: vi.fn().mockResolvedValue("environment-id-mock"),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    integration: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("Integration Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getEnvironmentIdFromWorkspaceId).mockResolvedValue("environment-id-mock");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockIntegrationConfig = {
    email: "test@example.com",
    key: {
      scope: "https://www.googleapis.com/auth/spreadsheets",
      token_type: "Bearer" as const,
      expiry_date: 1234567890,
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
    },
    data: [
      {
        spreadsheetId: "spreadsheet123",
        spreadsheetName: "Test Spreadsheet",
        surveyId: "survey123",
        surveyName: "Test Survey",
        elementIds: ["q1", "q2"],
        elements: "Question 1, Question 2",
        createdAt: new Date(),
        includeHiddenFields: false,
        includeMetadata: true,
        includeCreatedAt: true,
        includeVariables: false,
      },
    ],
  };

  describe("createOrUpdateIntegration", () => {
    const mockWorkspaceId = "clg123456789012345678901234";
    const mockIntegrationData: TIntegrationInput = {
      type: "googleSheets",
      config: mockIntegrationConfig,
    };

    test("should create a new integration", async () => {
      const mockIntegration = {
        id: "int_123",
        workspaceId: mockWorkspaceId,
        ...mockIntegrationData,
      };

      vi.mocked(prisma.integration.upsert).mockResolvedValue(mockIntegration);

      const result = await createOrUpdateIntegration(mockWorkspaceId, mockIntegrationData);

      expect(prisma.integration.upsert).toHaveBeenCalledWith({
        where: {
          type_workspaceId: {
            workspaceId: mockWorkspaceId,
            type: mockIntegrationData.type,
          },
        },
        update: {
          ...mockIntegrationData,
          environment: { connect: { id: "environment-id-mock" } },
          workspace: { connect: { id: mockWorkspaceId } },
        },
        create: {
          ...mockIntegrationData,
          environment: { connect: { id: "environment-id-mock" } },
          workspace: { connect: { id: mockWorkspaceId } },
        },
      });

      expect(result).toEqual(mockIntegration);
    });

    test("should throw DatabaseError when Prisma throws an error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.integration.upsert).mockRejectedValue(prismaError);

      await expect(createOrUpdateIntegration(mockWorkspaceId, mockIntegrationData)).rejects.toThrow(
        DatabaseError
      );
    });
  });

  describe("getIntegrations", () => {
    const mockWorkspaceId = "clg123456789012345678901234";
    const mockIntegrations = [
      {
        id: "int_123",
        workspaceId: mockWorkspaceId,
        type: IntegrationType.googleSheets,
        config: mockIntegrationConfig,
      },
    ];

    test("should get all integrations for an environment", async () => {
      vi.mocked(prisma.integration.findMany).mockResolvedValue(mockIntegrations);

      const result = await getIntegrations(mockWorkspaceId);

      expect(prisma.integration.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
        },
      });

      expect(result).toEqual(mockIntegrations);
    });

    test("should get paginated integrations", async () => {
      const page = 2;
      vi.mocked(prisma.integration.findMany).mockResolvedValue(mockIntegrations);

      const result = await getIntegrations(mockWorkspaceId, page);

      expect(prisma.integration.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
        },
        take: ITEMS_PER_PAGE,
        skip: ITEMS_PER_PAGE * (page - 1),
      });

      expect(result).toEqual(mockIntegrations);
    });

    test("should throw DatabaseError when Prisma throws an error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.integration.findMany).mockRejectedValue(prismaError);

      await expect(getIntegrations(mockWorkspaceId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getIntegration", () => {
    const mockIntegrationId = "int_123";
    const mockIntegration = {
      id: mockIntegrationId,
      workspaceId: "clg123456789012345678901234",
      type: IntegrationType.googleSheets,
      config: mockIntegrationConfig,
    };

    test("should get an integration by ID", async () => {
      vi.mocked(prisma.integration.findUnique).mockResolvedValue(mockIntegration);

      const result = await getIntegration(mockIntegrationId);

      expect(prisma.integration.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockIntegrationId,
        },
      });

      expect(result).toEqual(mockIntegration);
    });

    test("should return null when integration is not found", async () => {
      vi.mocked(prisma.integration.findUnique).mockResolvedValue(null);

      const result = await getIntegration(mockIntegrationId);

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when Prisma throws an error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.integration.findUnique).mockRejectedValue(prismaError);

      await expect(getIntegration(mockIntegrationId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getIntegrationByType", () => {
    const mockWorkspaceId = "clg123456789012345678901234";
    const mockType = IntegrationType.googleSheets;
    const mockIntegration = {
      id: "int_123",
      workspaceId: mockWorkspaceId,
      type: mockType,
      config: mockIntegrationConfig,
    };

    test("should get an integration by type", async () => {
      vi.mocked(prisma.integration.findFirst).mockResolvedValue(mockIntegration);

      const result = await getIntegrationByType(mockWorkspaceId, mockType);

      expect(prisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          type: mockType,
        },
      });

      expect(result).toEqual(mockIntegration);
    });

    test("should return null when integration is not found", async () => {
      vi.mocked(prisma.integration.findFirst).mockResolvedValue(null);

      const result = await getIntegrationByType(mockWorkspaceId, mockType);

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when Prisma throws an error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.integration.findFirst).mockRejectedValue(prismaError);

      await expect(getIntegrationByType(mockWorkspaceId, mockType)).rejects.toThrow(DatabaseError);
    });
  });

  describe("deleteIntegration", () => {
    const mockIntegrationId = "int_123";
    const mockIntegration = {
      id: mockIntegrationId,
      workspaceId: "clg123456789012345678901234",
      type: IntegrationType.googleSheets,
      config: mockIntegrationConfig,
    };

    test("should delete an integration", async () => {
      vi.mocked(prisma.integration.delete).mockResolvedValue(mockIntegration);

      const result = await deleteIntegration(mockIntegrationId);

      expect(prisma.integration.delete).toHaveBeenCalledWith({
        where: {
          id: mockIntegrationId,
        },
      });

      expect(result).toEqual(mockIntegration);
    });

    test("should throw DatabaseError when Prisma throws an error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.integration.delete).mockRejectedValue(prismaError);

      await expect(deleteIntegration(mockIntegrationId)).rejects.toThrow(DatabaseError);
    });
  });
});
