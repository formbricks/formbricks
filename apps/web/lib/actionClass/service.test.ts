import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TActionClass } from "@formbricks/types/action-classes";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { actionClassCache } from "./cache";
import {
  deleteActionClass,
  getActionClass,
  getActionClassByEnvironmentIdAndName,
  getActionClasses,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    actionClass: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
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
  actionClassCache: {
    tag: {
      byEnvironmentId: vi.fn(),
      byNameAndEnvironmentId: vi.fn(),
      byId: vi.fn(),
    },
    revalidate: vi.fn(),
  },
}));

describe("ActionClass Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getActionClasses", () => {
    test("should return action classes for environment", async () => {
      const mockActionClasses = [
        {
          id: "id1",
          createdAt: new Date(),
          updatedAt: new Date(),
          name: "Action 1",
          description: "desc",
          type: "code",
          key: "key1",
          noCodeConfig: {},
          environmentId: "env1",
        },
      ];
      vi.mocked(prisma.actionClass.findMany).mockResolvedValue(mockActionClasses);
      vi.mocked(actionClassCache.tag.byEnvironmentId).mockReturnValue("mock-tag");

      const result = await getActionClasses("env1");
      expect(result).toEqual(mockActionClasses);
      expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
        where: { environmentId: "env1" },
        select: expect.any(Object),
        take: undefined,
        skip: undefined,
        orderBy: { createdAt: "asc" },
      });
    });

    test("should throw DatabaseError when prisma throws", async () => {
      vi.mocked(prisma.actionClass.findMany).mockRejectedValue(new Error("fail"));
      vi.mocked(actionClassCache.tag.byEnvironmentId).mockReturnValue("mock-tag");
      await expect(getActionClasses("env1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getActionClassByEnvironmentIdAndName", () => {
    test("should return action class when found", async () => {
      const mockActionClass = {
        id: "id2",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Action 2",
        description: "desc2",
        type: "noCode",
        key: null,
        noCodeConfig: {},
        environmentId: "env2",
      };
      if (!prisma.actionClass.findFirst) prisma.actionClass.findFirst = vi.fn();
      vi.mocked(prisma.actionClass.findFirst).mockResolvedValue(mockActionClass);
      if (!actionClassCache.tag.byNameAndEnvironmentId) actionClassCache.tag.byNameAndEnvironmentId = vi.fn();
      vi.mocked(actionClassCache.tag.byNameAndEnvironmentId).mockReturnValue("mock-tag");

      const result = await getActionClassByEnvironmentIdAndName("env2", "Action 2");
      expect(result).toEqual(mockActionClass);
      expect(prisma.actionClass.findFirst).toHaveBeenCalledWith({
        where: { name: "Action 2", environmentId: "env2" },
        select: expect.any(Object),
      });
    });

    test("should return null when not found", async () => {
      if (!prisma.actionClass.findFirst) prisma.actionClass.findFirst = vi.fn();
      vi.mocked(prisma.actionClass.findFirst).mockResolvedValue(null);
      if (!actionClassCache.tag.byNameAndEnvironmentId) actionClassCache.tag.byNameAndEnvironmentId = vi.fn();
      vi.mocked(actionClassCache.tag.byNameAndEnvironmentId).mockReturnValue("mock-tag");
      const result = await getActionClassByEnvironmentIdAndName("env2", "Action 2");
      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      if (!prisma.actionClass.findFirst) prisma.actionClass.findFirst = vi.fn();
      vi.mocked(prisma.actionClass.findFirst).mockRejectedValue(new Error("fail"));
      if (!actionClassCache.tag.byNameAndEnvironmentId) actionClassCache.tag.byNameAndEnvironmentId = vi.fn();
      vi.mocked(actionClassCache.tag.byNameAndEnvironmentId).mockReturnValue("mock-tag");
      await expect(getActionClassByEnvironmentIdAndName("env2", "Action 2")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getActionClass", () => {
    test("should return action class when found", async () => {
      const mockActionClass = {
        id: "id3",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Action 3",
        description: "desc3",
        type: "code",
        key: "key3",
        noCodeConfig: {},
        environmentId: "env3",
      };
      if (!prisma.actionClass.findUnique) prisma.actionClass.findUnique = vi.fn();
      vi.mocked(prisma.actionClass.findUnique).mockResolvedValue(mockActionClass);
      if (!actionClassCache.tag.byId) actionClassCache.tag.byId = vi.fn();
      vi.mocked(actionClassCache.tag.byId).mockReturnValue("mock-tag");
      const result = await getActionClass("id3");
      expect(result).toEqual(mockActionClass);
      expect(prisma.actionClass.findUnique).toHaveBeenCalledWith({
        where: { id: "id3" },
        select: expect.any(Object),
      });
    });

    test("should return null when not found", async () => {
      if (!prisma.actionClass.findUnique) prisma.actionClass.findUnique = vi.fn();
      vi.mocked(prisma.actionClass.findUnique).mockResolvedValue(null);
      if (!actionClassCache.tag.byId) actionClassCache.tag.byId = vi.fn();
      vi.mocked(actionClassCache.tag.byId).mockReturnValue("mock-tag");
      const result = await getActionClass("id3");
      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      if (!prisma.actionClass.findUnique) prisma.actionClass.findUnique = vi.fn();
      vi.mocked(prisma.actionClass.findUnique).mockRejectedValue(new Error("fail"));
      if (!actionClassCache.tag.byId) actionClassCache.tag.byId = vi.fn();
      vi.mocked(actionClassCache.tag.byId).mockReturnValue("mock-tag");
      await expect(getActionClass("id3")).rejects.toThrow(DatabaseError);
    });
  });

  describe("deleteActionClass", () => {
    test("should delete and return action class", async () => {
      const mockActionClass: TActionClass = {
        id: "id4",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Action 4",
        description: null,
        type: "code",
        key: "key4",
        noCodeConfig: null,
        environmentId: "env4",
      };
      if (!prisma.actionClass.delete) prisma.actionClass.delete = vi.fn();
      vi.mocked(prisma.actionClass.delete).mockResolvedValue(mockActionClass);
      vi.mocked(actionClassCache.revalidate).mockReturnValue(undefined);
      const result = await deleteActionClass("id4");
      expect(result).toEqual(mockActionClass);
      expect(prisma.actionClass.delete).toHaveBeenCalledWith({
        where: { id: "id4" },
        select: expect.any(Object),
      });
      expect(actionClassCache.revalidate).toHaveBeenCalledWith({
        environmentId: mockActionClass.environmentId,
        id: "id4",
        name: mockActionClass.name,
      });
    });

    test("should throw ResourceNotFoundError if action class is null", async () => {
      if (!prisma.actionClass.delete) prisma.actionClass.delete = vi.fn();
      vi.mocked(prisma.actionClass.delete).mockResolvedValue(null as unknown as TActionClass);
      await expect(deleteActionClass("id4")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should rethrow unknown errors", async () => {
      if (!prisma.actionClass.delete) prisma.actionClass.delete = vi.fn();
      const error = new Error("unknown");
      vi.mocked(prisma.actionClass.delete).mockRejectedValue(error);
      await expect(deleteActionClass("id4")).rejects.toThrow("unknown");
    });
  });
});
