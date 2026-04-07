import { EnvironmentType, Prisma, Workspace } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironment, getEnvironments, updateEnvironment } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("Environment Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getEnvironment", () => {
    test("should return environment when found", async () => {
      const mockEnvironment = {
        id: "clh6pzwx90000e9ogjr0mf7sx",
        type: EnvironmentType.production,
        workspaceId: "clh6pzwx90000e9ogjr0mf7sy",
        createdAt: new Date(),
        updatedAt: new Date(),
        appSetupCompleted: false,
      };

      vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockEnvironment);

      const result = await getEnvironment("clh6pzwx90000e9ogjr0mf7sx");

      expect(result).toEqual(mockEnvironment);
      expect(prisma.environment.findUnique).toHaveBeenCalledWith({
        where: {
          id: "clh6pzwx90000e9ogjr0mf7sx",
        },
      });
    });

    test("should return null when environment not found", async () => {
      vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);

      const result = await getEnvironment("clh6pzwx90000e9ogjr0mf7sx");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.environment.findUnique).mockRejectedValue(prismaError);

      await expect(getEnvironment("clh6pzwx90000e9ogjr0mf7sx")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getEnvironments", () => {
    test("should return environments when workspace exists", async () => {
      const mockEnvironments = [
        {
          id: "clh6pzwx90000e9ogjr0mf7sx",
          type: EnvironmentType.production,
          workspaceId: "clh6pzwx90000e9ogjr0mf7sy",
          createdAt: new Date(),
          updatedAt: new Date(),
          appSetupCompleted: false,
        },
      ];

      vi.mocked(prisma.workspace.findFirst).mockResolvedValue({
        id: "clh6pzwx90000e9ogjr0mf7sy",
        name: "Test Workspace",
        environments: [
          {
            ...mockEnvironments[0],
          },
        ],
      } as unknown as Workspace);

      const result = await getEnvironments("clh6pzwx90000e9ogjr0mf7sy");

      expect(result).toEqual(mockEnvironments);
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: {
          id: "clh6pzwx90000e9ogjr0mf7sy",
        },
        include: {
          environments: true,
        },
      });
    });

    test("should throw ResourceNotFoundError when workspace not found", async () => {
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(getEnvironments("clh6pzwx90000e9ogjr0mf7sy")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.findFirst).mockRejectedValue(prismaError);

      await expect(getEnvironments("clh6pzwx90000e9ogjr0mf7sy")).rejects.toThrow(DatabaseError);
    });
  });

  describe("updateEnvironment", () => {
    test("should update environment successfully", async () => {
      const mockEnvironment = {
        id: "clh6pzwx90000e9ogjr0mf7sx",
        type: EnvironmentType.production,
        workspaceId: "clh6pzwx90000e9ogjr0mf7sy",
        createdAt: new Date(),
        updatedAt: new Date(),
        appSetupCompleted: false,
      };

      vi.mocked(prisma.environment.update).mockResolvedValue(mockEnvironment);

      const updateData = {
        appSetupCompleted: true,
      };

      const result = await updateEnvironment("clh6pzwx90000e9ogjr0mf7sx", updateData);

      expect(result).toEqual(mockEnvironment);
      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: {
          id: "clh6pzwx90000e9ogjr0mf7sx",
        },
        data: expect.objectContaining({
          appSetupCompleted: true,
          updatedAt: expect.any(Date),
        }),
      });
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.environment.update).mockRejectedValue(prismaError);

      await expect(
        updateEnvironment("clh6pzwx90000e9ogjr0mf7sx", { appSetupCompleted: true })
      ).rejects.toThrow(DatabaseError);
    });
  });
});
