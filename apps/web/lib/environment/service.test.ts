import { EnvironmentType, Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { environmentCache } from "./cache";
import { getEnvironment, getEnvironments, updateEnvironment } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("../cache", () => ({
  cache: vi.fn((fn) => fn),
}));

vi.mock("./cache", () => ({
  environmentCache: {
    revalidate: vi.fn(),
    tag: {
      byId: vi.fn(),
      byProjectId: vi.fn(),
    },
  },
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
        projectId: "clh6pzwx90000e9ogjr0mf7sy",
        createdAt: new Date(),
        updatedAt: new Date(),
        appSetupCompleted: false,
        widgetSetupCompleted: false,
      };

      vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockEnvironment);
      vi.mocked(environmentCache.tag.byId).mockReturnValue("mock-tag");

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
      vi.mocked(environmentCache.tag.byId).mockReturnValue("mock-tag");

      const result = await getEnvironment("clh6pzwx90000e9ogjr0mf7sx");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.environment.findUnique).mockRejectedValue(prismaError);
      vi.mocked(environmentCache.tag.byId).mockReturnValue("mock-tag");

      await expect(getEnvironment("clh6pzwx90000e9ogjr0mf7sx")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getEnvironments", () => {
    test("should return environments when project exists", async () => {
      const mockEnvironments = [
        {
          id: "clh6pzwx90000e9ogjr0mf7sx",
          type: EnvironmentType.production,
          projectId: "clh6pzwx90000e9ogjr0mf7sy",
          createdAt: new Date(),
          updatedAt: new Date(),
          appSetupCompleted: false,
        },
        {
          id: "clh6pzwx90000e9ogjr0mf7sz",
          type: EnvironmentType.development,
          projectId: "clh6pzwx90000e9ogjr0mf7sy",
          createdAt: new Date(),
          updatedAt: new Date(),
          appSetupCompleted: true,
        },
      ];

      vi.mocked(prisma.project.findFirst).mockResolvedValue({
        id: "clh6pzwx90000e9ogjr0mf7sy",
        name: "Test Project",
        environments: [
          {
            ...mockEnvironments[0],
            widgetSetupCompleted: false,
          },
          {
            ...mockEnvironments[1],
            widgetSetupCompleted: true,
          },
        ],
      });
      vi.mocked(environmentCache.tag.byProjectId).mockReturnValue("mock-tag");

      const result = await getEnvironments("clh6pzwx90000e9ogjr0mf7sy");

      expect(result).toEqual(mockEnvironments);
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: "clh6pzwx90000e9ogjr0mf7sy",
        },
        include: {
          environments: true,
        },
      });
    });

    test("should throw ResourceNotFoundError when project not found", async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
      vi.mocked(environmentCache.tag.byProjectId).mockReturnValue("mock-tag");

      await expect(getEnvironments("clh6pzwx90000e9ogjr0mf7sy")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.project.findFirst).mockRejectedValue(prismaError);
      vi.mocked(environmentCache.tag.byProjectId).mockReturnValue("mock-tag");

      await expect(getEnvironments("clh6pzwx90000e9ogjr0mf7sy")).rejects.toThrow(DatabaseError);
    });
  });

  describe("updateEnvironment", () => {
    test("should update environment successfully", async () => {
      const mockEnvironment = {
        id: "clh6pzwx90000e9ogjr0mf7sx",
        type: EnvironmentType.production,
        projectId: "clh6pzwx90000e9ogjr0mf7sy",
        createdAt: new Date(),
        updatedAt: new Date(),
        appSetupCompleted: false,
        widgetSetupCompleted: false,
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
      expect(environmentCache.revalidate).toHaveBeenCalledWith({
        id: "clh6pzwx90000e9ogjr0mf7sx",
        projectId: "clh6pzwx90000e9ogjr0mf7sy",
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
