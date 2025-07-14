import { TagError } from "@/modules/projects/settings/types/tag";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ok } from "@formbricks/types/error-handlers";
import { TTag } from "@formbricks/types/tags";
import { deleteTag, mergeTags, updateTagName } from "./tag";

const baseTag: TTag = {
  id: "cltag1234567890",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Tag1",
  environmentId: "clenv1234567890",
};

const newTag: TTag = {
  ...baseTag,
  id: "cltag0987654321",
  name: "Tag2",
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    tag: {
      delete: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    response: {
      findMany: vi.fn(),
    },

    $transaction: vi.fn(),
    tagsOnResponses: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("tag lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteTag", () => {
    test("deletes tag and revalidates cache", async () => {
      vi.mocked(prisma.tag.delete).mockResolvedValueOnce(baseTag);
      const result = await deleteTag(baseTag.id);
      expect(result).toEqual(ok(baseTag));
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: baseTag.id } });
    });
    test("returns tag_not_found on tag not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: PrismaErrorType.RecordDoesNotExist,
        clientVersion: "test",
      });
      vi.mocked(prisma.tag.delete).mockRejectedValueOnce(prismaError);

      const result = await deleteTag(baseTag.id);
      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error).toStrictEqual({
          code: TagError.TAG_NOT_FOUND,
          message: "Tag not found",
        });
      }
    });

    test("throws error on prisma error", async () => {
      vi.mocked(prisma.tag.delete).mockRejectedValueOnce(new Error("fail"));
      const result = await deleteTag(baseTag.id);
      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error).toStrictEqual({
          code: "unexpected_error",
          message: "fail",
        });
      }
    });
  });

  describe("updateTagName", () => {
    test("returns ok on successful update", async () => {
      vi.mocked(prisma.tag.update).mockResolvedValueOnce(baseTag);

      const result = await updateTagName(baseTag.id, "Tag1");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toEqual(baseTag);
      }

      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { id: baseTag.id },
        data: { name: "Tag1" },
      });
    });

    test("returns unique_constraint_failed on unique constraint violation", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "test",
      });
      vi.mocked(prisma.tag.update).mockRejectedValueOnce(prismaError);

      const result = await updateTagName(baseTag.id, "Tag1");
      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error).toStrictEqual({
          code: TagError.TAG_NAME_ALREADY_EXISTS,
          message: "Tag with this name already exists",
        });
      }
    });

    test("returns internal_server_error on unknown error", async () => {
      vi.mocked(prisma.tag.update).mockRejectedValueOnce(new Error("fail"));

      const result = await updateTagName(baseTag.id, "Tag1");
      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error).toStrictEqual({
          code: "unexpected_error",
          message: "fail",
        });
      }
    });
  });

  describe("mergeTags", () => {
    test("merges tags with responses with both tags", async () => {
      vi.mocked(prisma.tag.findUnique)
        .mockResolvedValueOnce(baseTag as any)
        .mockResolvedValueOnce(newTag as any);
      vi.mocked(prisma.response.findMany).mockResolvedValueOnce([{ id: "resp1" }] as any);
      vi.mocked(prisma.$transaction).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      const result = await mergeTags(baseTag.id, newTag.id);
      expect(result).toEqual(ok(newTag));
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({ where: { id: baseTag.id } });
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({ where: { id: newTag.id } });
      expect(prisma.response.findMany).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });
    test("merges tags with no responses with both tags", async () => {
      vi.mocked(prisma.tag.findUnique)
        .mockResolvedValueOnce(baseTag as any)
        .mockResolvedValueOnce(newTag as any);
      vi.mocked(prisma.response.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.$transaction).mockResolvedValueOnce(undefined);
      const result = await mergeTags(baseTag.id, newTag.id);
      expect(result).toEqual(ok(newTag));
    });
    test("throws if original tag not found", async () => {
      vi.mocked(prisma.tag.findUnique).mockResolvedValueOnce(null);
      const result = await mergeTags(baseTag.id, newTag.id);
      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error).toStrictEqual({
          code: "tag_not_found",
          message: "Tag not found",
        });
      }
    });
    test("throws if new tag not found", async () => {
      vi.mocked(prisma.tag.findUnique)
        .mockResolvedValueOnce(baseTag as any)
        .mockResolvedValueOnce(null);
      const result = await mergeTags(baseTag.id, newTag.id);
      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error).toStrictEqual({
          code: "tag_not_found",
          message: "Tag not found",
        });
      }
    });
    test("throws on prisma error", async () => {
      vi.mocked(prisma.tag.findUnique).mockRejectedValueOnce(new Error("fail"));
      const result = await mergeTags(baseTag.id, newTag.id);
      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error).toStrictEqual({
          code: "unexpected_error",
          message: "fail",
        });
      }
    });
  });
});
