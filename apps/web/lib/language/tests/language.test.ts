import {
  mockLanguage,
  mockLanguageId,
  mockLanguageInput,
  mockLanguageUpdate,
  mockUpdatedLanguage,
  mockWorkspaceId,
} from "./__mocks__/data.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { TWorkspace } from "@formbricks/types/workspace";
import { getWorkspace } from "@/lib/workspace/service";
import {
  createLanguage,
  deleteLanguage,
  describeLanguageInUse,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "../service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    language: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    surveyLanguage: { count: vi.fn(), findMany: vi.fn() },
  },
}));

// stub out workspace/service and caches
vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: vi.fn(),
}));

const fakeWorkspace = {
  id: mockWorkspaceId,
  languages: [],
  config: {},
} as unknown as TWorkspace;

const testInputValidation = async (
  service: (workspaceId: string, ...functionArgs: any[]) => Promise<any>,
  ...args: [string, ...any[]]
): Promise<void> => {
  test("throws ValidationError on bad input", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};

describe("createLanguage", () => {
  beforeEach(() => {
    vi.mocked(getWorkspace).mockResolvedValue(fakeWorkspace);
  });

  test("happy path creates a new Language", async () => {
    vi.mocked(prisma.language.create).mockResolvedValue(mockLanguage);
    const result = await createLanguage(mockWorkspaceId, mockLanguageInput);
    expect(result).toEqual(mockLanguage);
  });

  test("stores the canonical BCP-47 tag, normalizing a legacy code", async () => {
    vi.mocked(prisma.language.create).mockResolvedValue(mockLanguage);
    await createLanguage(mockWorkspaceId, { code: "de", alias: null });
    expect(prisma.language.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: "de-DE" }) })
    );
  });

  describe("sad path", () => {
    testInputValidation(createLanguage, "bad-id", {});

    test("throws ValidationError on a malformed/unparseable code", async () => {
      await expect(createLanguage(mockWorkspaceId, { code: "not a language", alias: null })).rejects.toThrow(
        ValidationError
      );
      expect(prisma.language.create).not.toHaveBeenCalled();
    });

    test("throws ValidationError for a valid code outside the curated catalog (CLDR-only fallback)", async () => {
      // `nso` normalizes to `nso-ZA` via the CLDR fallback, but that isn't in CANONICAL_LANGUAGE_CODES —
      // accepting it would let stored rows drift from the catalog the app supports.
      await expect(createLanguage(mockWorkspaceId, { code: "nso", alias: null })).rejects.toThrow(
        ValidationError
      );
      expect(prisma.language.create).not.toHaveBeenCalled();
    });

    test("throws DatabaseError when PrismaKnownRequestError", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "1",
      });
      vi.mocked(prisma.language.create).mockRejectedValue(err);
      await expect(createLanguage(mockWorkspaceId, mockLanguageInput)).rejects.toThrow(DatabaseError);
    });
  });
});

describe("updateLanguage", () => {
  beforeEach(() => {
    vi.mocked(getWorkspace).mockResolvedValue(fakeWorkspace);
  });

  test("happy path updates a language", async () => {
    const mockUpdatedLanguageWithSurveyLanguage = {
      ...mockUpdatedLanguage,
      surveyLanguages: [
        {
          id: "surveyLanguageId",
        },
      ],
    };
    vi.mocked(prisma.language.update).mockResolvedValue(mockUpdatedLanguageWithSurveyLanguage);
    const result = await updateLanguage(mockWorkspaceId, mockLanguageId, mockLanguageUpdate);
    expect(result).toEqual(mockUpdatedLanguage);
  });

  test("never writes `code` — only alias is mutable (invariant regardless of caller)", async () => {
    const mockUpdatedLanguageWithSurveyLanguage = {
      ...mockUpdatedLanguage,
      surveyLanguages: [{ id: "surveyLanguageId" }],
    };
    vi.mocked(prisma.language.update).mockResolvedValue(mockUpdatedLanguageWithSurveyLanguage);
    // Sneak a `code` into the runtime object (its declared type is alias-only) — it must be ignored so
    // Language.code can't drift to an arbitrary, non-canonical value on update.
    await updateLanguage(mockWorkspaceId, mockLanguageId, {
      code: "anything-non-canonical",
      alias: "New alias",
    } as unknown as typeof mockLanguageUpdate);

    const updateArg = vi.mocked(prisma.language.update).mock.calls[0][0];
    expect(updateArg.data).toEqual({ alias: "New alias", updatedAt: expect.any(Date) });
    expect(updateArg.data).not.toHaveProperty("code");
  });

  describe("sad path", () => {
    testInputValidation(updateLanguage, "bad-id", mockLanguageId, {});

    test("throws DatabaseError on PrismaKnownRequestError", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "1",
      });
      vi.mocked(prisma.language.update).mockRejectedValue(err);
      await expect(updateLanguage(mockWorkspaceId, mockLanguageId, mockLanguageUpdate)).rejects.toThrow(
        DatabaseError
      );
    });
  });
});

describe("deleteLanguage", () => {
  const workspaceOwningLanguage = {
    ...fakeWorkspace,
    languages: [{ ...mockLanguage, id: mockLanguageId, code: "fr-FR" }],
    config: {},
  } as unknown as TWorkspace;

  beforeEach(() => {
    vi.mocked(getWorkspace).mockResolvedValue(workspaceOwningLanguage);
    vi.mocked(prisma.surveyLanguage.count).mockReset().mockResolvedValue(0);
    vi.mocked(prisma.surveyLanguage.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.language.delete).mockReset();
  });

  test("happy path deletes a language", async () => {
    vi.mocked(prisma.language.delete).mockResolvedValue(mockLanguage);
    const result = await deleteLanguage(mockLanguageId, mockWorkspaceId, {});
    expect(result).toEqual(mockLanguage);
  });

  // ENG-3282: `SurveyLanguage` cascades, and restricted surveys are hidden from the settings UI that used
  // to warn about them, so the server refuses on its own and names only what the caller may see.
  describe("in-use guard", () => {
    const visibleSurveyWhere = { OR: [{ visibility: "workspace" as const }, { ownerId: "user-1" }] };

    const mockUsage = (total: number, visible: number, names: string[]) => {
      vi.mocked(prisma.surveyLanguage.count).mockImplementation((async (args: {
        where: { survey?: unknown };
      }) => (args.where.survey ? visible : total)) as never);
      vi.mocked(prisma.surveyLanguage.findMany).mockResolvedValue(
        names.map((name) => ({ survey: { name } })) as never
      );
    };

    test("refuses while any survey uses the language, counting the ones the caller cannot see", async () => {
      mockUsage(3, 1, ["Visible survey"]);

      const refusal = deleteLanguage(mockLanguageId, mockWorkspaceId, visibleSurveyWhere);

      await expect(refusal).rejects.toThrow(OperationNotAllowedError);
      await expect(refusal).rejects.toThrow(
        "This language is still used by Visible survey and 2 surveys you can't see."
      );
      expect(prisma.language.delete).not.toHaveBeenCalled();
      // The total is counted without the visibility clause; the names only through it.
      expect(prisma.surveyLanguage.count).toHaveBeenCalledWith({ where: { languageId: mockLanguageId } });
      expect(prisma.surveyLanguage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { languageId: mockLanguageId, survey: { AND: [visibleSurveyWhere] } },
          take: 10,
        })
      );
    });

    test("refuses with a bare count when the caller can see none of the surveys", async () => {
      mockUsage(2, 0, []);

      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId, visibleSurveyWhere)).rejects.toThrow(
        "This language is still used by 2 surveys you can't see."
      );
      expect(prisma.language.delete).not.toHaveBeenCalled();
    });

    test("deletes only a language no survey uses, enforced again at write time", async () => {
      vi.mocked(prisma.language.delete).mockResolvedValue(mockLanguage);

      await deleteLanguage(mockLanguageId, mockWorkspaceId, visibleSurveyWhere);

      expect(prisma.language.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockLanguageId, workspaceId: mockWorkspaceId, surveyLanguages: { none: {} } },
        })
      );
    });

    test("refuses when a survey starts using the language between the check and the delete", async () => {
      vi.mocked(prisma.language.delete).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion: "1" })
      );

      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId, visibleSurveyWhere)).rejects.toThrow(
        OperationNotAllowedError
      );
    });
  });

  describe("sad path", () => {
    testInputValidation(deleteLanguage, "bad-id", mockWorkspaceId, {});

    test("throws DatabaseError on PrismaKnownRequestError", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "1",
      });
      vi.mocked(prisma.language.delete).mockRejectedValue(err);
      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId, {})).rejects.toThrow(DatabaseError);
    });

    test("refuses to delete a language that is not one of the workspace's own", async () => {
      vi.mocked(getWorkspace).mockResolvedValue(fakeWorkspace);

      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId, {})).rejects.toThrow(
        ResourceNotFoundError
      );
      expect(prisma.language.delete).not.toHaveBeenCalled();
    });

    // ENG-2816: the workspace default survey language must keep naming a language the workspace has.
    test("refuses to delete the workspace default survey language", async () => {
      vi.mocked(getWorkspace).mockResolvedValue({
        ...fakeWorkspace,
        languages: [{ ...mockLanguage, id: mockLanguageId, code: "de-DE" }],
        config: { defaultSurveyLanguage: "de-DE" },
      } as unknown as TWorkspace);

      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId, {})).rejects.toThrow(
        OperationNotAllowedError
      );
      expect(prisma.language.delete).not.toHaveBeenCalled();
    });

    // A row stored under a legacy code is the same language as the canonical setting.
    test("refuses to delete a legacy-coded row that is the default", async () => {
      vi.mocked(getWorkspace).mockResolvedValue({
        ...fakeWorkspace,
        languages: [{ ...mockLanguage, id: mockLanguageId, code: "de" }],
        config: { defaultSurveyLanguage: "de-DE" },
      } as unknown as TWorkspace);

      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId, {})).rejects.toThrow(
        OperationNotAllowedError
      );
    });

    test("allows deleting a language that is not the default", async () => {
      vi.mocked(getWorkspace).mockResolvedValue({
        ...fakeWorkspace,
        languages: [{ ...mockLanguage, id: mockLanguageId, code: "fr-FR" }],
        config: { defaultSurveyLanguage: "de-DE" },
      } as unknown as TWorkspace);
      vi.mocked(prisma.language.delete).mockResolvedValue(mockLanguage);

      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId, {})).resolves.toEqual(mockLanguage);
    });
  });
});

describe("getSurveysUsingGivenLanguage (ENG-3282)", () => {
  beforeEach(() => {
    vi.mocked(prisma.surveyLanguage.findMany).mockReset();
    vi.mocked(prisma.surveyLanguage.findMany).mockResolvedValue([{ survey: { name: "Visible" } }] as never);
  });

  test("names only the surveys the caller's visibility predicate admits", async () => {
    const visibleSurveyWhere = { OR: [{ visibility: "workspace" as const }, { ownerId: "user-1" }] };

    await expect(getSurveysUsingGivenLanguage(mockLanguageId, visibleSurveyWhere)).resolves.toEqual([
      "Visible",
    ]);
    expect(prisma.surveyLanguage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { languageId: mockLanguageId, survey: { AND: [visibleSurveyWhere] } },
      })
    );
  });

  test("adds no survey clause while visibility is not enforced", async () => {
    await getSurveysUsingGivenLanguage(`${mockLanguageId}-off`, {});
    expect(prisma.surveyLanguage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { languageId: `${mockLanguageId}-off` } })
    );
  });
});

describe("describeLanguageInUse", () => {
  test("names visible surveys and summarises the ones beyond the list", () => {
    expect(describeLanguageInUse({ hiddenCount: 0, visibleCount: 12, visibleNames: ["A", "B"] })).toBe(
      "This language is still used by A, B and 10 more surveys. Remove the language from those surveys before deleting it."
    );
  });

  test("never names a hidden survey, only counts it", () => {
    expect(describeLanguageInUse({ hiddenCount: 1, visibleCount: 0, visibleNames: [] })).toBe(
      "This language is still used by 1 survey you can't see. Remove the language from those surveys before deleting it."
    );
  });
});
