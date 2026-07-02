import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createFeedbackSourceWithMappings,
  deleteFeedbackSource,
  getFeedbackSourceWithMappingsById,
  getFeedbackSourcesBySurveyId,
  getFeedbackSourcesWithMappings,
  updateFeedbackSource,
  updateFeedbackSourceWithMappings,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackSource: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    feedbackSourceFormbricksMapping: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    feedbackSourceFieldMapping: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

const ENV_ID = "clxxxxxxxxxxxxxxxx001";
const FEEDBACK_SOURCE_ID = "clxxxxxxxxxxxxxxxx002";
const SURVEY_ID = "clxxxxxxxxxxxxxxxx003";
const FRD_ID = "clxxxxxxxxxxxxxxxx004";
const NOW = new Date("2026-02-24T10:00:00.000Z");

const mockFeedbackSource = {
  id: FEEDBACK_SOURCE_ID,
  createdAt: NOW,
  updatedAt: NOW,
  name: "Test FeedbackSource",
  type: "formbricks_survey" as const,
  status: "active" as const,
  workspaceId: ENV_ID,
  lastSyncAt: null,
  createdBy: null,
};

const mockFeedbackSourceWithMappingsFromDb = {
  ...mockFeedbackSource,
  creator: null,
  formbricksMappings: [
    {
      id: "mapping-1",
      createdAt: NOW,
      feedbackSourceId: FEEDBACK_SOURCE_ID,
      workspaceId: ENV_ID,
      surveyId: SURVEY_ID,
      elementId: "el-1",
      hubFieldType: "text",
      customFieldLabel: null,
    },
  ],
  fieldMappings: [],
};

const mockFeedbackSourceWithMappings = {
  ...mockFeedbackSource,
  creatorName: null,
  formbricksMappings: mockFeedbackSourceWithMappingsFromDb.formbricksMappings,
  fieldMappings: [],
};

describe("getFeedbackSourcesWithMappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns feedbackSources for the given environment", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockResolvedValue([
      mockFeedbackSourceWithMappingsFromDb,
    ] as never);

    const result = await getFeedbackSourcesWithMappings(ENV_ID);

    expect(prisma.feedbackSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: ENV_ID },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(FEEDBACK_SOURCE_ID);
  });

  test("applies pagination when page is provided", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockResolvedValue([] as never);

    await getFeedbackSourcesWithMappings(ENV_ID, 2);

    expect(prisma.feedbackSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: expect.any(Number),
        skip: expect.any(Number),
      })
    );
  });

  test("returns empty array when no feedbackSources exist", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockResolvedValue([] as never);

    const result = await getFeedbackSourcesWithMappings(ENV_ID);
    expect(result).toEqual([]);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("connection error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(getFeedbackSourcesWithMappings(ENV_ID)).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockRejectedValue(new Error("boom"));

    await expect(getFeedbackSourcesWithMappings(ENV_ID)).rejects.toThrow("boom");
  });
});

describe("getFeedbackSourceWithMappingsById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the feedbackSource when found", async () => {
    vi.mocked(prisma.feedbackSource.findUnique).mockResolvedValue(
      mockFeedbackSourceWithMappingsFromDb as never
    );

    const result = await getFeedbackSourceWithMappingsById(FEEDBACK_SOURCE_ID, ENV_ID);

    expect(prisma.feedbackSource.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID },
      })
    );
    expect(result).toEqual(mockFeedbackSourceWithMappings);
  });

  test("returns null when not found", async () => {
    vi.mocked(prisma.feedbackSource.findUnique).mockResolvedValue(null as never);

    const result = await getFeedbackSourceWithMappingsById(FEEDBACK_SOURCE_ID, ENV_ID);
    expect(result).toBeNull();
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.feedbackSource.findUnique).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(getFeedbackSourceWithMappingsById(FEEDBACK_SOURCE_ID, ENV_ID)).rejects.toThrow(
      DatabaseError
    );
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.feedbackSource.findUnique).mockRejectedValue(new Error("boom"));

    await expect(getFeedbackSourceWithMappingsById(FEEDBACK_SOURCE_ID, ENV_ID)).rejects.toThrow("boom");
  });
});

describe("getFeedbackSourcesBySurveyId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns active formbricks feedbackSources linked to the survey", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockResolvedValue([
      mockFeedbackSourceWithMappingsFromDb,
    ] as never);

    const result = await getFeedbackSourcesBySurveyId(SURVEY_ID);

    expect(prisma.feedbackSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "formbricks_survey",
          status: "active",
          formbricksMappings: { some: { surveyId: SURVEY_ID } },
        },
      })
    );
    expect(result).toHaveLength(1);
  });

  test("returns empty when no feedbackSources match", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockResolvedValue([] as never);

    const result = await getFeedbackSourcesBySurveyId(SURVEY_ID);
    expect(result).toEqual([]);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(getFeedbackSourcesBySurveyId(SURVEY_ID)).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.feedbackSource.findMany).mockRejectedValue(new Error("boom"));

    await expect(getFeedbackSourcesBySurveyId(SURVEY_ID)).rejects.toThrow("boom");
  });
});

describe("updateFeedbackSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("updates feedbackSource name and returns the result", async () => {
    const updated = { ...mockFeedbackSource, name: "Renamed" };
    vi.mocked(prisma.feedbackSource.update).mockResolvedValue(updated as never);

    const result = await updateFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID, { name: "Renamed" });

    expect(prisma.feedbackSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID },
        data: expect.objectContaining({ name: "Renamed" }),
      })
    );
    expect(result.name).toBe("Renamed");
  });

  test("updates feedbackSource status", async () => {
    const updated = { ...mockFeedbackSource, status: "paused" };
    vi.mocked(prisma.feedbackSource.update).mockResolvedValue(updated as never);

    const result = await updateFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID, { status: "paused" });
    expect(result.status).toBe("paused");
  });

  test("throws ResourceNotFoundError when feedbackSource does not exist", async () => {
    vi.mocked(prisma.feedbackSource.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2015",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.feedbackSource.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      DatabaseError
    );
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.feedbackSource.update).mockRejectedValue(new Error("unexpected"));

    await expect(updateFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      "unexpected"
    );
  });
});

describe("deleteFeedbackSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("deletes the feedbackSource and returns it", async () => {
    vi.mocked(prisma.feedbackSource.delete).mockResolvedValue(mockFeedbackSource as never);

    const result = await deleteFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID);

    expect(prisma.feedbackSource.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID },
      })
    );
    expect(result.id).toBe(FEEDBACK_SOURCE_ID);
  });

  test("throws ResourceNotFoundError when feedbackSource does not exist", async () => {
    vi.mocked(prisma.feedbackSource.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2015",
        clientVersion: "5.0.0",
      })
    );

    await expect(deleteFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID)).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.feedbackSource.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(deleteFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID)).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.feedbackSource.delete).mockRejectedValue(new Error("boom"));

    await expect(deleteFeedbackSource(FEEDBACK_SOURCE_ID, ENV_ID)).rejects.toThrow("boom");
  });
});

describe("createFeedbackSourceWithMappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupTransaction = () => {
    const txMethods = {
      feedbackSource: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      feedbackSourceFormbricksMapping: {
        create: vi.fn(),
      },
      feedbackSourceFieldMapping: {
        create: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as unknown as (tx: typeof txMethods) => Promise<unknown>)(txMethods);
    });

    return txMethods;
  };

  test("creates feedbackSource without mappings", async () => {
    const tx = setupTransaction();
    tx.feedbackSource.create.mockResolvedValue({ id: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID });
    tx.feedbackSource.findUniqueOrThrow.mockResolvedValue(mockFeedbackSourceWithMappingsFromDb);

    const result = await createFeedbackSourceWithMappings(ENV_ID, {
      name: "New",
      type: "formbricks_survey",
      feedbackDirectoryId: FRD_ID,
    });

    expect(tx.feedbackSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: "New",
          type: "formbricks_survey",
          workspaceId: ENV_ID,
          feedbackDirectoryId: FRD_ID,
        },
      })
    );
    expect(tx.feedbackSourceFormbricksMapping.create).not.toHaveBeenCalled();
    expect(tx.feedbackSourceFieldMapping.create).not.toHaveBeenCalled();
    expect(result).toEqual(mockFeedbackSourceWithMappings);
  });

  test("creates feedbackSource with formbricks mappings", async () => {
    const tx = setupTransaction();
    tx.feedbackSource.create.mockResolvedValue({ id: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID });
    tx.feedbackSourceFormbricksMapping.create.mockResolvedValue({});
    tx.feedbackSource.findUniqueOrThrow.mockResolvedValue(mockFeedbackSourceWithMappingsFromDb);

    await createFeedbackSourceWithMappings(
      ENV_ID,
      { name: "FB", type: "formbricks_survey", feedbackDirectoryId: FRD_ID },
      {
        type: "formbricks_survey",
        mappings: [
          { surveyId: SURVEY_ID, elementId: "el-1", hubFieldType: "text" },
          { surveyId: SURVEY_ID, elementId: "el-2", hubFieldType: "nps" },
        ],
      }
    );

    expect(tx.feedbackSourceFormbricksMapping.create).toHaveBeenCalledTimes(2);
    expect(tx.feedbackSourceFormbricksMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feedbackSourceId: FEEDBACK_SOURCE_ID,
          workspaceId: ENV_ID,
          surveyId: SURVEY_ID,
          elementId: "el-1",
          hubFieldType: "text",
        }),
      })
    );
  });

  test("creates feedbackSource with field mappings", async () => {
    const tx = setupTransaction();
    tx.feedbackSource.create.mockResolvedValue({ id: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID });
    tx.feedbackSourceFieldMapping.create.mockResolvedValue({});
    tx.feedbackSource.findUniqueOrThrow.mockResolvedValue({
      ...mockFeedbackSource,
      formbricksMappings: [],
      fieldMappings: [],
    });

    await createFeedbackSourceWithMappings(
      ENV_ID,
      { name: "CSV", type: "csv", feedbackDirectoryId: FRD_ID },
      {
        type: "field",
        mappings: [{ sourceFieldId: "col-1", targetFieldId: "value_text" }],
      }
    );

    expect(tx.feedbackSourceFieldMapping.create).toHaveBeenCalledTimes(1);
    expect(tx.feedbackSourceFieldMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feedbackSourceId: FEEDBACK_SOURCE_ID,
          workspaceId: ENV_ID,
          sourceFieldId: "col-1",
          targetFieldId: "value_text",
        }),
      })
    );
  });

  test("throws FEEDBACK_SOURCE_NAME_DUPLICATE on FeedbackSource name unique violation", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["workspaceId", "name"] },
      })
    );

    await expect(
      createFeedbackSourceWithMappings(ENV_ID, {
        name: "Dup",
        type: "formbricks_survey",
        feedbackDirectoryId: FRD_ID,
      })
    ).rejects.toThrow(new InvalidInputError("FEEDBACK_SOURCE_NAME_DUPLICATE"));
  });

  test("throws FEEDBACK_SOURCE_FORMBRICKS_MAPPING_DUPLICATE on mapping unique violation", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["workspaceId", "feedbackSourceId", "surveyId", "elementId"] },
      })
    );

    await expect(
      createFeedbackSourceWithMappings(ENV_ID, {
        name: "Dup mapping",
        type: "formbricks_survey",
        feedbackDirectoryId: FRD_ID,
      })
    ).rejects.toThrow(new InvalidInputError("FEEDBACK_SOURCE_FORMBRICKS_MAPPING_DUPLICATE"));
  });

  test("throws FEEDBACK_SOURCE_FIELD_MAPPING_DUPLICATE on field mapping unique violation", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["workspaceId", "feedbackSourceId", "sourceFieldId", "targetFieldId"] },
      })
    );

    await expect(
      createFeedbackSourceWithMappings(ENV_ID, {
        name: "Dup field mapping",
        type: "csv",
        feedbackDirectoryId: FRD_ID,
      })
    ).rejects.toThrow(new InvalidInputError("FEEDBACK_SOURCE_FIELD_MAPPING_DUPLICATE"));
  });

  test("throws FEEDBACK_SOURCE_NAME_DUPLICATE on a unique violation without target meta", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
      })
    );

    await expect(
      createFeedbackSourceWithMappings(ENV_ID, {
        name: "Dup",
        type: "formbricks_survey",
        feedbackDirectoryId: FRD_ID,
      })
    ).rejects.toThrow(new InvalidInputError("FEEDBACK_SOURCE_NAME_DUPLICATE"));
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(
      createFeedbackSourceWithMappings(ENV_ID, { name: "Fail", type: "csv", feedbackDirectoryId: FRD_ID })
    ).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("boom"));

    await expect(
      createFeedbackSourceWithMappings(ENV_ID, { name: "Fail", type: "csv", feedbackDirectoryId: FRD_ID })
    ).rejects.toThrow("boom");
  });
});

describe("updateFeedbackSourceWithMappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupTransaction = () => {
    const txMethods = {
      feedbackSource: {
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      feedbackSourceFormbricksMapping: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      feedbackSourceFieldMapping: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as unknown as (tx: typeof txMethods) => Promise<unknown>)(txMethods);
    });

    return txMethods;
  };

  test("updates feedbackSource name without changing mappings", async () => {
    const tx = setupTransaction();
    tx.feedbackSource.update.mockResolvedValue(undefined);
    tx.feedbackSource.findUniqueOrThrow.mockResolvedValue(mockFeedbackSourceWithMappingsFromDb);

    const result = await updateFeedbackSourceWithMappings(FEEDBACK_SOURCE_ID, ENV_ID, { name: "Updated" });

    expect(tx.feedbackSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID },
        data: expect.objectContaining({ name: "Updated" }),
      })
    );
    expect(tx.feedbackSourceFormbricksMapping.deleteMany).not.toHaveBeenCalled();
    expect(tx.feedbackSourceFieldMapping.deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual(mockFeedbackSourceWithMappings);
  });

  test("replaces formbricks mappings when provided", async () => {
    const tx = setupTransaction();
    tx.feedbackSource.update.mockResolvedValue(undefined);
    tx.feedbackSourceFormbricksMapping.deleteMany.mockResolvedValue({ count: 1 });
    tx.feedbackSourceFormbricksMapping.create.mockResolvedValue({});
    tx.feedbackSource.findUniqueOrThrow.mockResolvedValue(mockFeedbackSourceWithMappingsFromDb);

    await updateFeedbackSourceWithMappings(
      FEEDBACK_SOURCE_ID,
      ENV_ID,
      { name: "Updated" },
      {
        type: "formbricks_survey",
        mappings: [{ surveyId: SURVEY_ID, elementId: "el-new", hubFieldType: "nps" }],
      }
    );

    expect(tx.feedbackSourceFormbricksMapping.deleteMany).toHaveBeenCalledWith({
      where: { feedbackSourceId: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID },
    });
    expect(tx.feedbackSourceFormbricksMapping.create).toHaveBeenCalledTimes(1);
  });

  test("replaces field mappings when provided", async () => {
    const tx = setupTransaction();
    tx.feedbackSource.update.mockResolvedValue(undefined);
    tx.feedbackSourceFieldMapping.deleteMany.mockResolvedValue({ count: 1 });
    tx.feedbackSourceFieldMapping.create.mockResolvedValue({});
    tx.feedbackSource.findUniqueOrThrow.mockResolvedValue({
      ...mockFeedbackSource,
      formbricksMappings: [],
      fieldMappings: [],
    });

    await updateFeedbackSourceWithMappings(
      FEEDBACK_SOURCE_ID,
      ENV_ID,
      { name: "CSV Updated" },
      {
        type: "field",
        mappings: [{ sourceFieldId: "col-x", targetFieldId: "value_number" }],
      }
    );

    expect(tx.feedbackSourceFieldMapping.deleteMany).toHaveBeenCalledWith({
      where: { feedbackSourceId: FEEDBACK_SOURCE_ID, workspaceId: ENV_ID },
    });
    expect(tx.feedbackSourceFieldMapping.create).toHaveBeenCalledTimes(1);
  });

  test("throws ResourceNotFoundError when feedbackSource does not exist", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2015",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateFeedbackSourceWithMappings(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  test("throws FEEDBACK_SOURCE_NAME_DUPLICATE on FeedbackSource name unique violation", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["workspaceId", "name"] },
      })
    );

    await expect(
      updateFeedbackSourceWithMappings(FEEDBACK_SOURCE_ID, ENV_ID, { name: "Dup" })
    ).rejects.toThrow(new InvalidInputError("FEEDBACK_SOURCE_NAME_DUPLICATE"));
  });

  test("throws FEEDBACK_SOURCE_FORMBRICKS_MAPPING_DUPLICATE on formbricks mapping unique violation", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["workspaceId", "feedbackSourceId", "surveyId", "elementId"] },
      })
    );

    await expect(updateFeedbackSourceWithMappings(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      new InvalidInputError("FEEDBACK_SOURCE_FORMBRICKS_MAPPING_DUPLICATE")
    );
  });

  test("throws FEEDBACK_SOURCE_FIELD_MAPPING_DUPLICATE on field mapping unique violation", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["workspaceId", "feedbackSourceId", "sourceFieldId", "targetFieldId"] },
      })
    );

    await expect(updateFeedbackSourceWithMappings(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      new InvalidInputError("FEEDBACK_SOURCE_FIELD_MAPPING_DUPLICATE")
    );
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateFeedbackSourceWithMappings(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      DatabaseError
    );
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("boom"));

    await expect(updateFeedbackSourceWithMappings(FEEDBACK_SOURCE_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      "boom"
    );
  });
});
