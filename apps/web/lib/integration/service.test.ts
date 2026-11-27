import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { IntegrationType, Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TIntegrationInput } from "@formbricks/types/integration";
import { ENCRYPTION_KEY, ITEMS_PER_PAGE } from "../constants";
import { symmetricDecrypt, symmetricEncrypt } from "../crypto";
import {
  createOrUpdateIntegration,
  deleteIntegration,
  getIntegration,
  getIntegrationByType,
  getIntegrations,
  saveIntegrationKeepingStoredKey,
} from "./service";

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  // A real key: the unit harness's placeholder is not a valid AES key length.
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
}));

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

      // ENG-7311: the tokens reach the database encrypted; the rest of the config is untouched.
      const call = vi.mocked(prisma.integration.upsert).mock.calls[0][0];
      const stored = call.create.config as typeof mockIntegrationConfig;
      expect(call.where).toEqual({
        type_workspaceId: { workspaceId: mockWorkspaceId, type: mockIntegrationData.type },
      });
      expect(call.update.config).toEqual(stored);
      expect(call.create.workspace).toEqual({ connect: { id: mockWorkspaceId } });
      expect(stored.key.access_token).not.toBe("mock-access-token");
      expect(symmetricDecrypt(stored.key.access_token, ENCRYPTION_KEY)).toBe("mock-access-token");
      expect(symmetricDecrypt(stored.key.refresh_token, ENCRYPTION_KEY)).toBe("mock-refresh-token");
      expect({ ...stored, key: { ...stored.key, access_token: "", refresh_token: "" } }).toEqual({
        ...mockIntegrationConfig,
        key: { ...mockIntegrationConfig.key, access_token: "", refresh_token: "" },
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

    test("updates the locked row, keeping its stored ciphertext over the redacted key", async () => {
      const storedConfig = {
        ...mockIntegrationConfig,
        key: {
          ...mockIntegrationConfig.key,
          access_token: symmetricEncrypt("stored-access", ENCRYPTION_KEY),
          refresh_token: symmetricEncrypt("stored-refresh", ENCRYPTION_KEY),
        },
      };
      const tx = mockTx([{ config: storedConfig }]);

      await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.integration.create).not.toHaveBeenCalled();
      // ENG-7311: the stored ciphertext is written back exactly as read — not re-encrypted, not blanked.
      expect(tx.integration.update).toHaveBeenCalledWith({
        where,
        data: {
          type: "googleSheets",
          config: { ...redacted.config, key: storedConfig.key },
          workspace: { connect: { id: mockWorkspaceId } },
        },
      });
    });

    test("writes a ciphertext that no longer decrypts back unchanged", async () => {
      // Encrypted under a different ENCRYPTION_KEY: the decrypting getter would have blanked it to "".
      const stale = symmetricEncrypt("old", "f".repeat(64));
      const storedConfig = {
        ...mockIntegrationConfig,
        key: { ...mockIntegrationConfig.key, access_token: stale },
      };
      const tx = mockTx([{ config: storedConfig }]);

      await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      expect(tx.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: expect.objectContaining({ key: expect.objectContaining({ access_token: stale }) }),
          }),
        })
      );
    });

    test("upgrades a legacy plaintext stored token to ciphertext on save", async () => {
      const tx = mockTx([{ config: mockIntegrationConfig }]);

      await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      const data = vi.mocked(tx.integration.update).mock.calls[0][0].data as {
        config: typeof mockIntegrationConfig;
      };
      expect(symmetricDecrypt(data.config.key.access_token, ENCRYPTION_KEY)).toBe("mock-access-token");
      expect(symmetricDecrypt(data.config.key.refresh_token, ENCRYPTION_KEY)).toBe("mock-refresh-token");
    });

    test("creates the row with the sent config when none is stored", async () => {
      const tx = mockTx([]);
      tx.survey.findMany.mockResolvedValueOnce([{ id: "survey123" }]);

      const result = await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      expect(result).toEqual({ id: "int_new" });
      expect(tx.integration.update).not.toHaveBeenCalled();
      const data = vi.mocked(tx.integration.create).mock.calls[0][0].data as {
        config: typeof mockIntegrationConfig;
      };
      // The client's blank stays blank; any plaintext credential is encrypted before it reaches the row.
      expect(data.config.key.access_token).toBe("");
      expect(symmetricDecrypt(data.config.key.refresh_token, ENCRYPTION_KEY)).toBe("mock-refresh-token");
      expect(data).toMatchObject({
        type: "googleSheets",
        workspace: { connect: { id: mockWorkspaceId } },
      });
    });

    test("checks newly mapped surveys on the transaction, not the app client", async () => {
      const tx = mockTx([{ config: { ...mockIntegrationConfig, data: [] } }]);
      tx.survey.findMany.mockResolvedValueOnce([{ id: "survey123" }]);

      await saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted);

      expect(tx.survey.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.survey.findMany).not.toHaveBeenCalled();
    });

    test("refuses a newly mapped survey from another workspace", async () => {
      const tx = mockTx([{ config: { ...mockIntegrationConfig, data: [] } }]);
      tx.survey.findMany.mockResolvedValueOnce([]);

      await expect(saveIntegrationKeepingStoredKey(mockWorkspaceId, redacted)).rejects.toThrow(
        ResourceNotFoundError
      );

      expect(tx.survey.findMany.mock.calls[0][0]).toEqual({
        where: { id: { in: ["survey123"] }, workspaceId: mockWorkspaceId },
        select: { id: true },
      });
      expect(tx.integration.update).not.toHaveBeenCalled();
    });

    test("throws DatabaseError when Prisma rejects the write", async () => {
      const tx = mockTx([]);
      tx.survey.findMany.mockResolvedValueOnce([{ id: "survey123" }]);
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

    test("decrypts stored tokens and tolerates legacy plaintext rows (ENG-7311)", async () => {
      const encryptedConfig = {
        ...mockIntegrationConfig,
        key: {
          ...mockIntegrationConfig.key,
          access_token: symmetricEncrypt("encrypted-access", ENCRYPTION_KEY),
          refresh_token: symmetricEncrypt("encrypted-refresh", ENCRYPTION_KEY),
        },
      };
      vi.mocked(prisma.integration.findMany).mockResolvedValue([
        {
          id: "enc",
          workspaceId: mockWorkspaceId,
          type: IntegrationType.googleSheets,
          config: encryptedConfig,
        },
        {
          id: "legacy",
          workspaceId: mockWorkspaceId,
          type: IntegrationType.googleSheets,
          config: mockIntegrationConfig,
        },
      ] as never);

      const [encrypted, legacy] = await getIntegrations(mockWorkspaceId);

      expect(encrypted.config.key).toMatchObject({
        access_token: "encrypted-access",
        refresh_token: "encrypted-refresh",
      });
      expect(legacy.config.key).toMatchObject({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
      });
    });

    test("one row whose token no longer decrypts reads as disconnected without hiding the others", async () => {
      const foreignKeyConfig = {
        ...mockIntegrationConfig,
        key: { ...mockIntegrationConfig.key, access_token: symmetricEncrypt("old", "f".repeat(64)) },
      };
      const healthyConfig = {
        ...mockIntegrationConfig,
        key: { ...mockIntegrationConfig.key, access_token: symmetricEncrypt("current", ENCRYPTION_KEY) },
      };
      vi.mocked(prisma.integration.findMany).mockResolvedValue([
        { id: "broken", workspaceId: mockWorkspaceId, type: IntegrationType.slack, config: foreignKeyConfig },
        {
          id: "healthy",
          workspaceId: mockWorkspaceId,
          type: IntegrationType.googleSheets,
          config: healthyConfig,
        },
      ] as never);

      const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

      const [broken, healthy] = await getIntegrations(mockWorkspaceId);

      expect(broken.config.key).toMatchObject({ access_token: "" });
      expect(healthy.config.key).toMatchObject({ access_token: "current" });
      expect(warn).toHaveBeenCalledWith(
        { integrationId: "broken", workspaceId: mockWorkspaceId, type: IntegrationType.slack },
        expect.stringContaining("needs reconnecting")
      );
      expect(warn).not.toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: "healthy" }),
        expect.anything()
      );
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
