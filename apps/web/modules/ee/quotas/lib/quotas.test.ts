import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { TSurveyQuota, TSurveyQuotaInput } from "@formbricks/types/quota";
import { validateInputs } from "@/lib/utils/validate";
import {
  createQuota,
  deleteQuota,
  getQuota,
  getQuotas,
  reduceQuotaLimits,
  syncQuotaMatrixConditions,
  updateQuota,
} from "./quotas";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    surveyQuota: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    survey: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("Quota Service", () => {
  const mockSurveyId = "survey123";
  const mockQuotaId = "quota123";

  const mockQuota: TSurveyQuota = {
    id: mockQuotaId,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    surveyId: mockSurveyId,
    name: "Test Quota",
    limit: 100,
    logic: {
      connector: "and",
      conditions: [],
    },
    action: "endSurvey",
    endingCardId: null,
    countPartialSubmissions: false,
  };

  beforeEach(() => {
    vi.mocked(validateInputs).mockImplementation(() => {
      return [];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuota", () => {
    test("should return quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.findUnique).mockResolvedValue(mockQuota);
      const result = await getQuota(mockQuotaId);
      expect(result).toEqual(mockQuota);
    });

    test("should throw ResourceNotFoundError if quota not found", async () => {
      vi.mocked(prisma.surveyQuota.findUnique).mockResolvedValue(null);
      await expect(getQuota(mockQuotaId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.findUnique).mockRejectedValue(prismaError);
      await expect(getQuota(mockQuotaId)).rejects.toThrow(DatabaseError);
    });

    test("should throw ValidationError when validateInputs fails", async () => {
      vi.mocked(validateInputs).mockImplementation(() => {
        throw new ValidationError("Invalid input");
      });
      await expect(getQuota(mockQuotaId)).rejects.toThrow(ValidationError);
    });
  });

  describe("getQuotas", () => {
    test("should return quotas successfully", async () => {
      const mockQuotas = [mockQuota];
      vi.mocked(prisma.surveyQuota.findMany).mockResolvedValue(mockQuotas);

      const result = await getQuotas(mockSurveyId);

      expect(result).toEqual(mockQuotas);
      expect(validateInputs).toHaveBeenCalledWith([mockSurveyId, expect.any(Object)]);
      expect(prisma.surveyQuota.findMany).toHaveBeenCalledWith({
        where: { surveyId: mockSurveyId },
        orderBy: { createdAt: "desc" },
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(prismaError);

      await expect(getQuotas(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    test("should throw ValidationError when validateInputs fails", async () => {
      vi.mocked(validateInputs).mockImplementation(() => {
        throw new ValidationError("Invalid input");
      });

      await expect(getQuotas(mockSurveyId)).rejects.toThrow(ValidationError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(genericError);

      await expect(getQuotas(mockSurveyId)).rejects.toThrow("Generic error");
    });
  });

  describe("createQuota", () => {
    const createInput: TSurveyQuotaInput = {
      surveyId: mockSurveyId,
      name: "New Quota",
      limit: 50,
      logic: {
        connector: "and",
        conditions: [],
      },
      action: "endSurvey",
      endingCardId: null,
      countPartialSubmissions: false,
    };

    test("should create quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.create).mockResolvedValue(mockQuota);

      const result = await createQuota(createInput);

      expect(result).toEqual(mockQuota);
      expect(prisma.surveyQuota.create).toHaveBeenCalledWith({
        data: createInput,
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.create).mockRejectedValue(prismaError);

      await expect(createQuota(createInput)).rejects.toThrow(InvalidInputError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.create).mockRejectedValue(genericError);

      await expect(createQuota(createInput)).rejects.toThrow("Generic error");
    });
  });

  describe("updateQuota", () => {
    const updateInput: TSurveyQuotaInput = {
      name: "Updated Quota",
      surveyId: mockSurveyId,
      limit: 75,
      logic: {
        connector: "or",
        conditions: [],
      },
      action: "continueSurvey",
      endingCardId: "ending123",
      countPartialSubmissions: true,
    };

    test("should update quota successfully", async () => {
      const updatedQuota = { ...mockQuota, ...updateInput };
      vi.mocked(prisma.surveyQuota.update).mockResolvedValue(updatedQuota);

      const result = await updateQuota(updateInput, mockQuotaId);

      expect(result).toEqual(updatedQuota);
      // surveyId is immutable on update (ENG-1749) and is stripped from the persisted data.
      const { surveyId: _omittedSurveyId, ...expectedData } = updateInput;
      expect(prisma.surveyQuota.update).toHaveBeenCalledWith({
        where: { id: mockQuotaId },
        data: expectedData,
      });
    });

    // ENG-1749 sibling: updateQuota must not re-point a quota to a different (potentially
    // cross-tenant) survey. Even when a foreign surveyId is supplied, it must not be persisted.
    test("never persists a caller-supplied surveyId", async () => {
      vi.mocked(prisma.surveyQuota.update).mockResolvedValue(mockQuota);

      await updateQuota({ ...updateInput, surveyId: "clvictimsurvey0000000000001" }, mockQuotaId);

      const arg = vi.mocked(prisma.surveyQuota.update).mock.calls[0][0];
      expect(arg.data).not.toHaveProperty("surveyId");
    });

    test("should throw ResourceNotFoundError when quota not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(prismaError);

      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Quota",
        resourceId: mockQuotaId,
      });
    });

    test("should throw DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(prismaError);

      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toThrow(InvalidInputError);
    });

    test("should throw error on unknown error", async () => {
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(new Error("Unknown error"));
      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toThrow(Error);
    });
  });

  describe("matrix conditions by id (ENG-6934)", () => {
    // The survey's matrix after a reorder: Disney+ is now row 0, Netflix row 1; Good column 0.
    const surveyBlocks = [
      {
        id: "block1",
        elements: [
          {
            id: "grid",
            type: "matrix",
            rows: [{ id: "row_disney" }, { id: "row_netflix" }],
            columns: [{ id: "col_good" }, { id: "col_poor" }],
          },
        ],
      },
    ];
    const withCondition = (
      meta: Record<string, string>,
      rightOperand: Record<string, unknown>
    ): TSurveyQuotaInput => ({
      surveyId: mockSurveyId,
      name: "Netflix fans",
      limit: 50,
      logic: {
        connector: "and",
        conditions: [
          {
            id: "cond1",
            leftOperand: { type: "element", value: "grid", meta },
            operator: "equals",
            rightOperand: { type: "static", value: "0", ...rightOperand },
          },
        ],
      },
      action: "endSurvey",
      endingCardId: null,
      countPartialSubmissions: false,
    });
    const writtenCondition = (call: { data: { logic?: unknown } }) =>
      (call.data.logic as TSurveyQuotaInput["logic"]).conditions[0];

    beforeEach(() => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue({ blocks: surveyBlocks } as never);
      vi.mocked(prisma.surveyQuota.create).mockResolvedValue(mockQuota);
      vi.mocked(prisma.surveyQuota.update).mockResolvedValue(mockQuota);
    });

    test("create writes the ids next to positions the editor sent alone", async () => {
      await createQuota(withCondition({ row: "1" }, { value: "0" }));

      expect(prisma.survey.findFirst).toHaveBeenCalledWith({
        where: { id: mockSurveyId },
        select: { blocks: true },
      });
      expect(writtenCondition(vi.mocked(prisma.surveyQuota.create).mock.calls[0][0])).toMatchObject({
        leftOperand: { meta: { row: "1", rowId: "row_netflix" } },
        rightOperand: { value: "0", columnId: "col_good" },
      });
    });

    test("update rewrites stale positions from the ids, reading the quota's own survey", async () => {
      await updateQuota(
        withCondition({ row: "0", rowId: "row_netflix" }, { value: "1", columnId: "col_good" }),
        mockQuotaId
      );

      expect(prisma.survey.findFirst).toHaveBeenCalledWith({
        where: { quotas: { some: { id: mockQuotaId } } },
        select: { blocks: true },
      });
      expect(writtenCondition(vi.mocked(prisma.surveyQuota.update).mock.calls[0][0])).toMatchObject({
        leftOperand: { meta: { row: "1", rowId: "row_netflix" } },
        rightOperand: { value: "0", columnId: "col_good" },
      });
    });

    test("refuses a row id the matrix doesn't have, and does not write", async () => {
      await expect(createQuota(withCondition({ row: "0", rowId: "row_hulu" }, {}))).rejects.toThrow(
        'Row id "row_hulu" does not exist in matrix question "grid" (logic.conditions.0.leftOperand.meta.rowId)'
      );
      expect(prisma.surveyQuota.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteQuota", () => {
    test("should delete quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.delete).mockResolvedValue(mockQuota);

      const result = await deleteQuota(mockQuotaId);

      expect(result).toEqual(mockQuota);
      expect(prisma.surveyQuota.delete).toHaveBeenCalledWith({
        where: { id: mockQuotaId },
      });
    });

    test("should throw ResourceNotFoundError when quota not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(prismaError);

      await expect(deleteQuota(mockQuotaId)).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Quota",
        resourceId: mockQuotaId,
      });
    });

    test("should throw DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(prismaError);

      await expect(deleteQuota(mockQuotaId)).rejects.toThrow(DatabaseError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(genericError);

      await expect(deleteQuota(mockQuotaId)).rejects.toThrow("Generic error");
    });
  });

  describe("reduceQuotaLimits", () => {
    test("should reduce quota limits successfully", async () => {
      vi.mocked(prisma.surveyQuota.updateMany).mockResolvedValue({ count: 1 });
      await reduceQuotaLimits([mockQuotaId]);
      expect(prisma.surveyQuota.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [mockQuotaId] }, limit: { gt: 1 } },
        data: { limit: { decrement: 1 } },
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.updateMany).mockRejectedValue(prismaError);
      await expect(reduceQuotaLimits([mockQuotaId])).rejects.toThrow(DatabaseError);
    });

    test("should throw error on unknown error", async () => {
      vi.mocked(prisma.surveyQuota.updateMany).mockRejectedValue(new Error("Unknown error"));
      await expect(reduceQuotaLimits([mockQuotaId])).rejects.toThrow(Error);
    });
  });
});

describe("syncQuotaMatrixConditions (ENG-6934)", () => {
  // The rows were reordered: row_b now sits first. The quota was written when row_b was second.
  const blocks = [
    {
      id: "b1",
      elements: [
        {
          id: "grid",
          type: "matrix",
          rows: [{ id: "row_b" }, { id: "row_a" }],
          columns: [{ id: "col_x" }, { id: "col_y" }],
        },
      ],
    },
  ];
  const condition = (row: string) => ({
    id: "c1",
    leftOperand: { type: "element" as const, value: "grid", meta: { row, rowId: "row_b" } },
    operator: "equals" as const,
    rightOperand: { type: "static" as const, value: "1", columnId: "col_y" },
  });

  test("rewrites a quota's stale matrix positions from its ids, inside the save's transaction", async () => {
    const tx = {
      surveyQuota: {
        findMany: vi.fn().mockResolvedValue([
          { id: "stale", logic: { connector: "and", conditions: [condition("1")] } },
          { id: "in_sync", logic: { connector: "and", conditions: [condition("0")] } },
        ]),
        update: vi.fn(),
      },
    };

    await syncQuotaMatrixConditions(tx as never, "survey123", blocks);

    expect(tx.surveyQuota.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { surveyId: "survey123" } })
    );
    expect(tx.surveyQuota.update).toHaveBeenCalledTimes(1);
    expect(tx.surveyQuota.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stale" },
        data: { logic: { connector: "and", conditions: [condition("0")] } },
      })
    );
  });
});
