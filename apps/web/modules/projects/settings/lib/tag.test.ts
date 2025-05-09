import { tagCache } from "@/lib/tag/cache";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
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
vi.mock("@/lib/tag/cache", () => ({
  tagCache: {
    revalidate: vi.fn(),
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
      vi.mocked(tagCache.revalidate).mockImplementation(() => {});
      const result = await deleteTag(baseTag.id);
      expect(result).toEqual(baseTag);
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: baseTag.id } });
      expect(tagCache.revalidate).toHaveBeenCalledWith({
        id: baseTag.id,
        environmentId: baseTag.environmentId,
      });
    });
    test("throws error on prisma error", async () => {
      vi.mocked(prisma.tag.delete).mockRejectedValueOnce(new Error("fail"));
      await expect(deleteTag(baseTag.id)).rejects.toThrow("fail");
    });
  });

  describe("updateTagName", () => {
    test("updates tag name and revalidates cache", async () => {
      vi.mocked(prisma.tag.update).mockResolvedValueOnce(baseTag);
      vi.mocked(tagCache.revalidate).mockImplementation(() => {});
      const result = await updateTagName(baseTag.id, "Tag1");
      expect(result).toEqual(baseTag);
      expect(prisma.tag.update).toHaveBeenCalledWith({ where: { id: baseTag.id }, data: { name: "Tag1" } });
      expect(tagCache.revalidate).toHaveBeenCalledWith({
        id: baseTag.id,
        environmentId: baseTag.environmentId,
      });
    });
    test("throws error on prisma error", async () => {
      vi.mocked(prisma.tag.update).mockRejectedValueOnce(new Error("fail"));
      await expect(updateTagName(baseTag.id, "Tag1")).rejects.toThrow("fail");
    });
  });

  describe("mergeTags", () => {
    test("merges tags with responses with both tags", async () => {
      vi.mocked(prisma.tag.findUnique)
        .mockResolvedValueOnce(baseTag as any)
        .mockResolvedValueOnce(newTag as any);
      vi.mocked(prisma.response.findMany).mockResolvedValueOnce([{ id: "resp1" }] as any);
      vi.mocked(prisma.$transaction).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      vi.mocked(tagCache.revalidate).mockImplementation(() => {});
      const result = await mergeTags(baseTag.id, newTag.id);
      expect(result).toEqual(newTag);
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
      vi.mocked(tagCache.revalidate).mockImplementation(() => {});
      const result = await mergeTags(baseTag.id, newTag.id);
      expect(result).toEqual(newTag);
      expect(tagCache.revalidate).toHaveBeenCalledWith({
        id: baseTag.id,
        environmentId: baseTag.environmentId,
      });
      expect(tagCache.revalidate).toHaveBeenCalledWith({ id: newTag.id });
    });
    test("throws if original tag not found", async () => {
      vi.mocked(prisma.tag.findUnique).mockResolvedValueOnce(null);
      await expect(mergeTags(baseTag.id, newTag.id)).rejects.toThrow("Tag not found");
    });
    test("throws if new tag not found", async () => {
      vi.mocked(prisma.tag.findUnique)
        .mockResolvedValueOnce(baseTag as any)
        .mockResolvedValueOnce(null);
      await expect(mergeTags(baseTag.id, newTag.id)).rejects.toThrow("Tag not found");
    });
    test("throws on prisma error", async () => {
      vi.mocked(prisma.tag.findUnique).mockRejectedValueOnce(new Error("fail"));
      await expect(mergeTags(baseTag.id, newTag.id)).rejects.toThrow("fail");
    });
  });
});
