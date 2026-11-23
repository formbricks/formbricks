import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { IntegrationType, Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { TIntegrationInput } from "@formbricks/types/integration";
import { ITEMS_PER_PAGE } from "../constants";
import {
  createOrUpdateIntegration,
  deleteIntegration,
  getIntegration,
  getIntegrationByType,
  getIntegrations,
  saveIntegrationKeepingStoredKey,
} from "./service";

// Survey visibility (ENG-3282) is not enforced here: the readiness marker is off, not read from a database.
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn(async () => false) }));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    survey: { findMany: vi.fn() },
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
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);
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
          workspace: { connect: { id: mockWorkspaceId } },
        },
        create: {
          ...mockIntegrationData,
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

  describe("saveIntegrationKeepingStoredKey", () => {
    const mockWorkspaceId = "clg123456789012345678901234";
    const redacted = {
      type: "googleSheets" as const,
      config: { ...mockIntegrationConfig, key: { ...mockIntegrationConfig.key, access_token: "" } },
    };
    const where = { type_workspaceId: { workspaceId: mockWorkspaceId, type: "googleSheets" } };

    // The transaction client: the locking read, the write, and the visibility check's survey read.
    const mockTx = (lockedRows: { config: unknown }[]) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue(lockedRows),
        survey: { findMany: vi.fn().mockResolvedValue([]) },
        integration: {
          update: vi.fn().mockResolvedValue({ id: "int_123" }),
          create: vi.fn().mockResolvedValue({ id: "int_new" }),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(((run: (client: typeof tx) => unknown) =>
        run(tx)) as never);
      return tx;
    };

    test("updates the locked row, keeping its stored key over the redacted one", async () => {
      const tx = mockTx([{ config: mockIntegrationConfig }]);

      await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.integration.create).not.toHaveBeenCalled();
      expect(tx.integration.update).toHaveBeenCalledWith({
        where,
        data: {
          type: "googleSheets",
          config: { ...redacted.config, key: mockIntegrationConfig.key },
          workspace: { connect: { id: mockWorkspaceId } },
        },
      });
    });

    test("creates the row with the sent config when none is stored", async () => {
      const tx = mockTx([]);

      const result = await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      expect(result).toEqual({ id: "int_new" });
      expect(tx.integration.update).not.toHaveBeenCalled();
      expect(tx.integration.create).toHaveBeenCalledWith({
        data: { ...redacted, workspace: { connect: { id: mockWorkspaceId } } },
      });
    });

    test("checks newly mapped surveys on the transaction, not the app client", async () => {
      const tx = mockTx([{ config: { ...mockIntegrationConfig, data: [] } }]);

      await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      expect(tx.survey.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.survey.findMany).not.toHaveBeenCalled();
    });

    test("throws DatabaseError when Prisma rejects the write", async () => {
      const tx = mockTx([]);
      tx.integration.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.0.0",
        })
      );

      await expect(saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted)).rejects.toThrow(DatabaseError);
    });

    test("rethrows an error that is not Prisma's unchanged", async () => {
      const tx = mockTx([{ config: mockIntegrationConfig }]);
      const failure = new Error("boom");
      tx.integration.update.mockRejectedValue(failure);

      await expect(saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted)).rejects.toBe(failure);
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

    test("should get all integrations for a workspace", async () => {
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
