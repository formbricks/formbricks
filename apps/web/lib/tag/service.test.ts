import { TagError } from "@/modules/projects/settings/types/tag";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TTag } from "@formbricks/types/tags";
import { createTag, getTag, getTagsByEnvironmentId } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("Tag Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTagsByEnvironmentId", () => {
    test("should return tags for a given environment ID", async () => {
      const mockTags: TTag[] = [
        {
          id: "tag1",
          name: "Tag 1",
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags);

      const result = await getTagsByEnvironmentId("env1");
      expect(result).toEqual(mockTags);
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          environmentId: "env1",
        },
        take: undefined,
        skip: undefined,
      });
    });

    test("should handle pagination correctly", async () => {
      const mockTags: TTag[] = [
        {
          id: "tag1",
          name: "Tag 1",
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags);

      const result = await getTagsByEnvironmentId("env1", 1);
      expect(result).toEqual(mockTags);
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          environmentId: "env1",
        },
        take: 30,
        skip: 0,
      });
    });
  });

  describe("getTag", () => {
    test("should return a tag by ID", async () => {
      const mockTag: TTag = {
        id: "tag1",
        name: "Tag 1",
        environmentId: "env1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.tag.findUnique).mockResolvedValue(mockTag);

      const result = await getTag("tag1");
      expect(result).toEqual(mockTag);
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: {
          id: "tag1",
        },
      });
    });

    test("should return null when tag is not found", async () => {
      vi.mocked(prisma.tag.findUnique).mockResolvedValue(null);

      const result = await getTag("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("createTag", () => {
    test("should create a new tag", async () => {
      const mockTag: TTag = {
        id: "tag1",
        name: "New Tag",
        environmentId: "env1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.tag.create).mockResolvedValue(mockTag);

      const result = await createTag("env1", "New Tag");
      expect(result).toEqual({ ok: true, data: mockTag });
      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: {
          name: "New Tag",
          environmentId: "env1",
        },
      });
    });

    test("should handle duplicate tag name error", async () => {
      // const duplicateError = new Error("Unique constraint failed");
      // (duplicateError as any).code = "P2002";
      const duplicateError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "4.0.0",
      });

      vi.mocked(prisma.tag.create).mockRejectedValue(duplicateError);
      const result = await createTag("env1", "Duplicate Tag");
      expect(result).toEqual({
        ok: false,
        error: { message: "Tag with this name already exists", code: TagError.TAG_NAME_ALREADY_EXISTS },
      });
    });
    test("should handle general database errors", async () => {
      const generalError = new Error("Database connection failed");
      vi.mocked(prisma.tag.create).mockRejectedValue(generalError);
      const result = await createTag("env1", "New Tag");
      expect(result).toStrictEqual({
        ok: false,
        error: { message: "Database connection failed", code: TagError.UNEXPECTED_ERROR },
      });
    });
  });
});
