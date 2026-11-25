import { mockDisplayId, mockSurveyId } from "./__mocks__/data.mock";
import { prisma } from "@/lib/__mocks__/database";
import { describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import {
  assertDisplayOwnership,
  getDisplayCountBySurveyId,
  getDisplayForResponseValidation,
  getDisplaysByContactId,
  getDisplaysBySurveyIdWithContact,
  isDisplayOfSurvey,
} from "../service";

const mockContactId = "clqnj99r9000008lebgf8734j";
const mockWorkspaceId = "clqkr8dlv000308jybb08evgz";
const mockResponseId = "clqnfg59i000208i426pb4wcv";

const mockDisplaysForContact = [
  {
    id: mockDisplayId,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    surveyId: mockSurveyId,
  },
  {
    id: "clqkr5smu000208jy50v6g5k5",
    createdAt: new Date("2024-01-14T10:00:00Z"),
    surveyId: "clqkr8dlv000308jybb08evgs",
  },
];

const mockDisplaysWithContact = [
  {
    id: mockDisplayId,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    surveyId: mockSurveyId,
    contact: {
      id: mockContactId,
      attributes: [
        { attributeKey: { key: "email" }, value: "test@example.com" },
        { attributeKey: { key: "userId" }, value: "user-123" },
      ],
    },
  },
  {
    id: "clqkr5smu000208jy50v6g5k5",
    createdAt: new Date("2024-01-14T10:00:00Z"),
    surveyId: "clqkr8dlv000308jybb08evgs",
    contact: {
      id: "clqnj99r9000008lebgf8734k",
      attributes: [{ attributeKey: { key: "userId" }, value: "user-456" }],
    },
  },
];

describe("getDisplayCountBySurveyId", () => {
  describe("Happy Path", () => {
    const dateRange = {
      min: new Date("2024-01-01T00:00:00.000Z"),
      max: new Date("2024-01-31T23:59:59.999Z"),
    };

    test("counts displays by surveyId", async () => {
      vi.mocked(prisma.display.count).mockResolvedValue(5);

      const result = await getDisplayCountBySurveyId(mockSurveyId);

      expect(result).toBe(5);
      expect(prisma.display.count).toHaveBeenCalledWith({
        where: {
          surveyId: mockSurveyId,
        },
      });
    });

    test("counts displays by date range when no response IDs are supplied", async () => {
      vi.mocked(prisma.display.count).mockResolvedValue(2);

      const result = await getDisplayCountBySurveyId(mockSurveyId, {
        createdAt: dateRange,
      });

      expect(result).toBe(2);
      expect(prisma.display.count).toHaveBeenCalledWith({
        where: {
          surveyId: mockSurveyId,
          createdAt: {
            gte: dateRange.min,
            lte: dateRange.max,
          },
        },
      });
    });

    test.each([
      { label: "no date bounds", createdAt: undefined },
      { label: "both date bounds", createdAt: dateRange },
    ])("binds response IDs as a single array with $label", async ({ createdAt }) => {
      const responseIds = [mockResponseId, "clqnfg59i000208i426pb4wcw"];
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 2n }]);

      await expect(getDisplayCountBySurveyId(mockSurveyId, { createdAt, responseIds })).resolves.toBe(2);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(Prisma.sql(strings, ...values).values).toEqual([
        mockSurveyId,
        responseIds,
        ...(createdAt ? [createdAt.min, createdAt.max] : []),
      ]);
    });

    test("returns 0 without querying when responseIds filter is empty", async () => {
      const result = await getDisplayCountBySurveyId(mockSurveyId, { responseIds: [] });

      expect(result).toBe(0);
      expect(prisma.display.count).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("Sad Path", () => {
    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.display.count).mockRejectedValue(errToThrow);

      await expect(getDisplayCountBySurveyId(mockSurveyId)).rejects.toThrow(DatabaseError);
    });
  });
});

describe("getDisplaysByContactId", () => {
  describe("Happy Path", () => {
    test("returns displays for a contact ordered by createdAt desc", async () => {
      vi.mocked(prisma.display.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockDisplaysForContact
      );

      const result = await getDisplaysByContactId(mockContactId, mockWorkspaceId, {});

      expect(result).toEqual(mockDisplaysForContact);
      expect(prisma.display.findMany).toHaveBeenCalledWith({
        where: { contactId: mockContactId, contact: { workspaceId: mockWorkspaceId } },
        select: {
          id: true,
          createdAt: true,
          surveyId: true,
        },
        orderBy: { createdAt: "desc" },
      });
    });

    test("returns empty array when contact has no displays", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([]);

      const result = await getDisplaysByContactId(mockContactId, mockWorkspaceId, {});

      expect(result).toEqual([]);
    });

    // ENG-2290: a contact id alone is not a tenant boundary. The query must join through the
    // contact's workspace so an authorized workspace id cannot be paired with a foreign contact.
    test("scopes the query to the workspace of the contact", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([]);

      await getDisplaysByContactId(mockContactId, mockWorkspaceId, {});

      expect(prisma.display.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contact: { workspaceId: mockWorkspaceId } }),
        })
      );
    });
  });

  describe("Sad Path", () => {
    test("throws a ValidationError if the contactId is invalid", async () => {
      await expect(getDisplaysByContactId("not-a-cuid", mockWorkspaceId, {})).rejects.toThrow(
        ValidationError
      );
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.display.findMany).mockRejectedValue(errToThrow);

      await expect(getDisplaysByContactId(mockContactId, mockWorkspaceId, {})).rejects.toThrow(DatabaseError);
    });

    test("throws generic Error for other exceptions", async () => {
      vi.mocked(prisma.display.findMany).mockRejectedValue(new Error("Mock error"));

      await expect(getDisplaysByContactId(mockContactId, mockWorkspaceId, {})).rejects.toThrow(Error);
    });
  });
});

describe("getDisplaysBySurveyIdWithContact", () => {
  describe("Happy Path", () => {
    test("returns displays with contact attributes transformed", async () => {
      vi.mocked(prisma.display.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockDisplaysWithContact
      );

      const result = await getDisplaysBySurveyIdWithContact(mockSurveyId, 15, 0);

      expect(result).toEqual([
        {
          id: mockDisplayId,
          createdAt: new Date("2024-01-15T10:00:00Z"),
          surveyId: mockSurveyId,
          contact: {
            id: mockContactId,
            attributes: { email: "test@example.com", userId: "user-123" },
          },
        },
        {
          id: "clqkr5smu000208jy50v6g5k5",
          createdAt: new Date("2024-01-14T10:00:00Z"),
          surveyId: "clqkr8dlv000308jybb08evgs",
          contact: {
            id: "clqnj99r9000008lebgf8734k",
            attributes: { userId: "user-456" },
          },
        },
      ]);
    });

    test("calls prisma with correct where clause and pagination", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([]);

      await getDisplaysBySurveyIdWithContact(mockSurveyId, 15, 0);

      expect(prisma.display.findMany).toHaveBeenCalledWith({
        where: {
          surveyId: mockSurveyId,
          contactId: { not: null },
        },
        select: {
          id: true,
          createdAt: true,
          surveyId: true,
          contact: {
            select: {
              id: true,
              attributes: {
                where: {
                  attributeKey: {
                    key: { in: ["email", "userId"] },
                  },
                },
                select: {
                  attributeKey: { select: { key: true } },
                  value: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
        skip: 0,
      });
    });

    test("returns empty array when no displays found", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([]);

      const result = await getDisplaysBySurveyIdWithContact(mockSurveyId);

      expect(result).toEqual([]);
    });

    test("handles display with null contact", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([
        {
          id: mockDisplayId,
          createdAt: new Date("2024-01-15T10:00:00Z"),
          surveyId: mockSurveyId,
          contact: null,
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.display.findMany>>);

      const result = await getDisplaysBySurveyIdWithContact(mockSurveyId);

      expect(result).toEqual([
        {
          id: mockDisplayId,
          createdAt: new Date("2024-01-15T10:00:00Z"),
          surveyId: mockSurveyId,
          contact: null,
        },
      ]);
    });
  });

  describe("Sad Path", () => {
    test("throws a ValidationError if the surveyId is invalid", async () => {
      await expect(getDisplaysBySurveyIdWithContact("not-a-cuid")).rejects.toThrow(ValidationError);
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.display.findMany).mockRejectedValue(errToThrow);

      await expect(getDisplaysBySurveyIdWithContact(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    test("throws generic Error for other exceptions", async () => {
      vi.mocked(prisma.display.findMany).mockRejectedValue(new Error("Mock error"));

      await expect(getDisplaysBySurveyIdWithContact(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});

const mockDisplayRecord = {
  surveyId: mockSurveyId,
  contactId: null as string | null,
  response: null as { id: string } | null,
  survey: { workspaceId: mockWorkspaceId },
};

describe("getDisplayForResponseValidation", () => {
  test("returns null when display is not found", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue(null);
    const result = await getDisplayForResponseValidation(mockDisplayId);
    expect(result).toBeNull();
  });

  test("returns mapped shape when display is found", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue({
      ...mockDisplayRecord,
      contactId: mockContactId,
      response: { id: mockResponseId },
    } as unknown as Awaited<ReturnType<typeof prisma.display.findUnique>>);
    const result = await getDisplayForResponseValidation(mockDisplayId);
    expect(result).toEqual({
      surveyId: mockSurveyId,
      workspaceId: mockWorkspaceId,
      responseId: mockResponseId,
      contactId: mockContactId,
    });
  });

  test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
    vi.mocked(prisma.display.findUnique).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      })
    );
    await expect(getDisplayForResponseValidation(mockDisplayId)).rejects.toThrow(DatabaseError);
  });
});

describe("assertDisplayOwnership", () => {
  test("throws InvalidInputError when display is not found", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue(null);
    await expect(assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, null)).rejects.toThrow(
      InvalidInputError
    );
  });

  test("throws InvalidInputError when workspaceId does not match", async () => {
    vi.mocked(prisma.display.findUnique, { partial: true, deep: true }).mockResolvedValue(mockDisplayRecord);
    await expect(
      assertDisplayOwnership(mockDisplayId, "wrong-workspace", mockSurveyId, null)
    ).rejects.toThrow(InvalidInputError);
  });

  test("throws InvalidInputError when surveyId does not match", async () => {
    vi.mocked(prisma.display.findUnique, { partial: true, deep: true }).mockResolvedValue(mockDisplayRecord);
    await expect(
      assertDisplayOwnership(mockDisplayId, mockWorkspaceId, "wrong-survey", null)
    ).rejects.toThrow(InvalidInputError);
  });

  test("throws InvalidInputError when display is already linked to a response", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue({
      ...mockDisplayRecord,
      response: { id: mockResponseId },
    } as unknown as Awaited<ReturnType<typeof prisma.display.findUnique>>);
    await expect(assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, null)).rejects.toThrow(
      InvalidInputError
    );
  });

  test("throws InvalidInputError when contactId does not match", async () => {
    vi.mocked(prisma.display.findUnique, { partial: true, deep: true }).mockResolvedValue({
      ...mockDisplayRecord,
      contactId: "contact-a",
    });
    await expect(
      assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, "contact-b")
    ).rejects.toThrow(InvalidInputError);
  });

  // ENG-2240: the public client-response routes echo this error's message, so every rejection must
  // read the same. Rejection-only tests above pass with the oracle intact.
  test("rejects every ownership failure with the same message, so the wire response can't tell them apart", async () => {
    const rejectionFor = async (
      record: typeof mockDisplayRecord | null,
      args: [workspaceId: string, surveyId: string, contactId: string | null]
    ): Promise<Error> => {
      vi.mocked(prisma.display.findUnique, { partial: true, deep: true }).mockResolvedValueOnce(record);
      return assertDisplayOwnership(mockDisplayId, ...args).then(
        () => {
          throw new Error("expected a rejection");
        },
        (error: Error) => error
      );
    };

    const missing = await rejectionFor(null, [mockWorkspaceId, mockSurveyId, null]);
    const otherWorkspace = await rejectionFor(mockDisplayRecord, ["wrong-workspace", mockSurveyId, null]);
    const otherSurvey = await rejectionFor(mockDisplayRecord, [mockWorkspaceId, "wrong-survey", null]);
    const claimed = await rejectionFor({ ...mockDisplayRecord, response: { id: mockResponseId } }, [
      mockWorkspaceId,
      mockSurveyId,
      null,
    ]);
    const otherContact = await rejectionFor({ ...mockDisplayRecord, contactId: "contact-a" }, [
      mockWorkspaceId,
      mockSurveyId,
      "contact-b",
    ]);

    for (const rejection of [otherWorkspace, otherSurvey, claimed, otherContact]) {
      expect(rejection).toBeInstanceOf(InvalidInputError);
      expect(rejection.message).toBe(missing.message);
    }
    expect(missing.message).not.toContain(mockDisplayId);
  });

  // A displayId that isn't a cuid2 fails validation before the lookup. It must read like any other
  // unusable display, not as "Validation failed" (v1) or an unmapped 500 (v2).
  test("rejects a malformed displayId with the same message, without querying", async () => {
    vi.mocked(prisma.display.findUnique).mockClear();
    vi.mocked(prisma.display.findUnique, { partial: true, deep: true }).mockResolvedValueOnce(null);
    const missing = await assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, null).catch(
      (error: Error) => error
    );
    vi.mocked(prisma.display.findUnique).mockClear();

    const malformed = await assertDisplayOwnership("Not A Cuid!", mockWorkspaceId, mockSurveyId, null).catch(
      (error: Error) => error
    );

    expect(malformed).toBeInstanceOf(InvalidInputError);
    expect((malformed as Error).message).toBe((missing as Error).message);
    expect(prisma.display.findUnique).not.toHaveBeenCalled();
  });

  test("logs at most 64 characters of the client-supplied displayId", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const oversized = "a".repeat(10_000);
    vi.mocked(prisma.display.findUnique, { partial: true, deep: true }).mockResolvedValueOnce(null);

    await expect(assertDisplayOwnership(oversized, mockWorkspaceId, mockSurveyId, null)).rejects.toThrow(
      InvalidInputError
    );

    const [fields] = warn.mock.calls[0] as unknown as [{ displayId: string }, string];
    expect(fields.displayId).toHaveLength(64);
    warn.mockRestore();
  });

  test("resolves without error when all ownership checks pass", async () => {
    vi.mocked(prisma.display.findUnique, { partial: true, deep: true }).mockResolvedValue({
      ...mockDisplayRecord,
      contactId: mockContactId,
    });
    await expect(
      assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, mockContactId)
    ).resolves.toBeUndefined();
  });
});

describe("isDisplayOfSurvey", () => {
  test("is true for a display of the survey", async () => {
    vi.mocked(prisma.display.findUnique, { partial: true }).mockResolvedValue({ surveyId: mockSurveyId });
    await expect(isDisplayOfSurvey(mockDisplayId, mockSurveyId)).resolves.toBe(true);
    expect(prisma.display.findUnique).toHaveBeenCalledWith({
      where: { id: mockDisplayId },
      select: { surveyId: true },
    });
  });

  // One `false` for both, so callers cannot turn this into a display-id existence oracle.
  test.each([
    ["belongs to another survey", { surveyId: "other-survey" }],
    ["does not exist", null],
  ])("is false for a display that %s", async (_label, row) => {
    vi.mocked(prisma.display.findUnique, { partial: true }).mockResolvedValue(row);
    await expect(isDisplayOfSurvey(mockDisplayId, mockSurveyId)).resolves.toBe(false);
  });

  test("reads through the transaction client when given one", async () => {
    const tx = { display: { findUnique: vi.fn().mockResolvedValue({ surveyId: mockSurveyId }) } };
    await expect(
      isDisplayOfSurvey(mockDisplayId, mockSurveyId, tx as unknown as Prisma.TransactionClient)
    ).resolves.toBe(true);
    expect(tx.display.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.display.findUnique).not.toHaveBeenCalled();
  });
});
