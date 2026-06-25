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
