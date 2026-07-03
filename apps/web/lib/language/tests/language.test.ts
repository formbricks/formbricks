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
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { TWorkspace } from "@formbricks/types/workspace";
import { getWorkspace } from "@/lib/workspace/service";
import { createLanguage, deleteLanguage, updateLanguage } from "../service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    language: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// stub out workspace/service and caches
vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: vi.fn(),
}));

const fakeWorkspace = {
  id: mockWorkspaceId,
} as TWorkspace;

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
  beforeEach(() => {
    vi.mocked(getWorkspace).mockResolvedValue(fakeWorkspace);
  });

  test("happy path deletes a language", async () => {
    vi.mocked(prisma.language.delete).mockResolvedValue(mockLanguage);
    const result = await deleteLanguage(mockLanguageId, mockWorkspaceId);
    expect(result).toEqual(mockLanguage);
  });

  describe("sad path", () => {
    testInputValidation(deleteLanguage, "bad-id", mockWorkspaceId);

    test("throws DatabaseError on PrismaKnownRequestError", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "1",
      });
      vi.mocked(prisma.language.delete).mockRejectedValue(err);
      await expect(deleteLanguage(mockLanguageId, mockWorkspaceId)).rejects.toThrow(DatabaseError);
    });
  });
});
