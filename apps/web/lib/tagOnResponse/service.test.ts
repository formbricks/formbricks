import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getResponse } from "../response/service";
import { addTagToRespone, deleteTagOnResponse, getTagsOnResponsesCount } from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    tagsOnResponses: {
      create: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("../response/service", () => ({
  getResponse: vi.fn(),
}));

describe("TagOnResponse Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("addTagToRespone should add a tag to a response", async () => {
    const mockResponse = {
      id: "response1",
      surveyId: "survey1",
      contact: { id: "contact1" },
    };

    const mockTagOnResponse = {
      tag: {
        workspaceId: "workspace1",
      },
    };

    vi.mocked(getResponse).mockResolvedValue(mockResponse as any);
    vi.mocked(prisma.tagsOnResponses.create).mockResolvedValue(mockTagOnResponse as any);

    const result = await addTagToRespone("response1", "tag1");

    expect(result).toEqual({
      responseId: "response1",
      tagId: "tag1",
    });

    expect(prisma.tagsOnResponses.create).toHaveBeenCalledWith({
      data: {
        responseId: "response1",
        tagId: "tag1",
      },
      select: {
        tag: {
          select: {
            workspaceId: true,
          },
        },
      },
    });
  });

  test("deleteTagOnResponse should delete a tag from a response", async () => {
    const mockResponse = {
      id: "response1",
      surveyId: "survey1",
      contact: { id: "contact1" },
    };

    const mockDeletedTag = {
      tag: {
        workspaceId: "workspace1",
      },
    };

    vi.mocked(getResponse).mockResolvedValue(mockResponse as any);
    vi.mocked(prisma.tagsOnResponses.delete).mockResolvedValue(mockDeletedTag as any);

    const result = await deleteTagOnResponse("response1", "tag1");

    expect(result).toEqual({
      responseId: "response1",
      tagId: "tag1",
    });

    expect(prisma.tagsOnResponses.delete).toHaveBeenCalledWith({
      where: {
        responseId_tagId: {
          responseId: "response1",
          tagId: "tag1",
        },
      },
      select: {
        tag: {
          select: {
            workspaceId: true,
          },
        },
      },
    });
  });

  test("getTagsOnResponsesCount should return tag counts for a workspace", async () => {
    const mockTagsCount = [
      { tagId: "tag1", _count: { _all: 5 } },
      { tagId: "tag2", _count: { _all: 3 } },
    ];

    vi.mocked(prisma.tagsOnResponses.groupBy).mockResolvedValue(mockTagsCount as any);

    const result = await getTagsOnResponsesCount("env1");

    expect(result).toEqual([
      { tagId: "tag1", count: 5 },
      { tagId: "tag2", count: 3 },
    ]);

    expect(prisma.tagsOnResponses.groupBy).toHaveBeenCalledWith({
      by: ["tagId"],
      where: {
        response: {
          survey: {
            workspaceId: "env1",
          },
        },
      },
      _count: {
        _all: true,
      },
    });
  });

  test("addTagToRespone should be a no-op when the tag is already on the response (P2002)", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`responseId`,`tagId`)",
      {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["responseId", "tagId"] },
      }
    );
    vi.mocked(prisma.tagsOnResponses.create).mockRejectedValue(prismaError);

    const result = await addTagToRespone("response1", "tag1");

    expect(result).toEqual({
      responseId: "response1",
      tagId: "tag1",
    });
  });

  test("addTagToRespone should not throw when called twice with the same (responseId, tagId)", async () => {
    const mockTagOnResponse = {
      tag: {
        workspaceId: "workspace1",
      },
    };
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`responseId`,`tagId`)",
      {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["responseId", "tagId"] },
      }
    );

    vi.mocked(prisma.tagsOnResponses.create)
      .mockResolvedValueOnce(mockTagOnResponse as any)
      .mockRejectedValueOnce(prismaError);

    const first = await addTagToRespone("response1", "tag1");
    const second = await addTagToRespone("response1", "tag1");

    expect(first).toEqual({ responseId: "response1", tagId: "tag1" });
    expect(second).toEqual({ responseId: "response1", tagId: "tag1" });
  });

  test("addTagToRespone should throw DatabaseError for non-P2002 prisma errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.tagsOnResponses.create).mockRejectedValue(prismaError);

    await expect(addTagToRespone("response1", "tag1")).rejects.toThrow(DatabaseError);
  });

  test("addTagToRespone should throw DatabaseError for P2002 on a different target", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`someOtherField`)",
      {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["someOtherField"] },
      }
    );
    vi.mocked(prisma.tagsOnResponses.create).mockRejectedValue(prismaError);

    await expect(addTagToRespone("response1", "tag1")).rejects.toThrow(DatabaseError);
  });

  test("addTagToRespone should throw DatabaseError for P2002 without meta.target", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.tagsOnResponses.create).mockRejectedValue(prismaError);

    await expect(addTagToRespone("response1", "tag1")).rejects.toThrow(DatabaseError);
  });
});
