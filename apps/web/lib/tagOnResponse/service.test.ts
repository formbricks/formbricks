import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { responseCache } from "../response/cache";
import { getResponse } from "../response/service";
import { tagOnResponseCache } from "./cache";
import { addTagToRespone, deleteTagOnResponse, getTagsOnResponsesCount } from "./service";

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

vi.mock("../response/cache", () => ({
  responseCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("./cache", () => ({
  tagOnResponseCache: {
    revalidate: vi.fn(),
    tag: {
      byEnvironmentId: vi.fn(),
    },
  },
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
        environmentId: "env1",
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
            environmentId: true,
          },
        },
      },
    });

    expect(responseCache.revalidate).toHaveBeenCalledWith({
      id: "response1",
      surveyId: "survey1",
      contactId: "contact1",
    });

    expect(tagOnResponseCache.revalidate).toHaveBeenCalledWith({
      tagId: "tag1",
      responseId: "response1",
      environmentId: "env1",
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
        environmentId: "env1",
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
            environmentId: true,
          },
        },
      },
    });

    expect(responseCache.revalidate).toHaveBeenCalledWith({
      id: "response1",
      surveyId: "survey1",
      contactId: "contact1",
    });

    expect(tagOnResponseCache.revalidate).toHaveBeenCalledWith({
      tagId: "tag1",
      responseId: "response1",
      environmentId: "env1",
    });
  });

  test("getTagsOnResponsesCount should return tag counts for an environment", async () => {
    const mockTagsCount = [
      { tagId: "tag1", _count: { _all: 5 } },
      { tagId: "tag2", _count: { _all: 3 } },
    ];

    vi.mocked(prisma.tagsOnResponses.groupBy).mockResolvedValue(mockTagsCount as any);
    vi.mocked(tagOnResponseCache.tag.byEnvironmentId).mockReturnValue("env1");

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
            environment: {
              id: "env1",
            },
          },
        },
      },
      _count: {
        _all: true,
      },
    });
  });

  test("should throw DatabaseError when prisma operation fails", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.tagsOnResponses.create).mockRejectedValue(prismaError);

    await expect(addTagToRespone("response1", "tag1")).rejects.toThrow(DatabaseError);
  });
});
