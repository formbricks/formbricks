import {
  mockLanguage,
  mockLanguageId,
  mockLanguageInput,
  mockLanguageUpdate,
  mockProjectId,
  mockUpdatedLanguage,
} from "./__mocks__/data.mock";
import { getProject } from "@/lib/project/service";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { TProject } from "@formbricks/types/project";
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

// stub out project/service and caches
vi.mock("@/lib/project/service", () => ({
  getProject: vi.fn(),
}));

const fakeProject = {
  id: mockProjectId,
  environments: [{ id: "env1" }, { id: "env2" }],
} as TProject;

const testInputValidation = async (
  service: (projectId: string, ...functionArgs: any[]) => Promise<any>,
  ...args: any[]
): Promise<void> => {
  test("throws ValidationError on bad input", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};

describe("createLanguage", () => {
  beforeEach(() => {
    vi.mocked(getProject).mockResolvedValue(fakeProject);
  });

  test("happy path creates a new Language", async () => {
    vi.mocked(prisma.language.create).mockResolvedValue(mockLanguage);
    const result = await createLanguage(mockProjectId, mockLanguageInput);
    expect(result).toEqual(mockLanguage);
  });

  describe("sad path", () => {
    testInputValidation(createLanguage, "bad-id", {});

    test("throws DatabaseError when PrismaKnownRequestError", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "1",
      });
      vi.mocked(prisma.language.create).mockRejectedValue(err);
      await expect(createLanguage(mockProjectId, mockLanguageInput)).rejects.toThrow(DatabaseError);
    });
  });
});

describe("updateLanguage", () => {
  beforeEach(() => {
    vi.mocked(getProject).mockResolvedValue(fakeProject);
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
    const result = await updateLanguage(mockProjectId, mockLanguageId, mockLanguageUpdate);
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
      await expect(updateLanguage(mockProjectId, mockLanguageId, mockLanguageUpdate)).rejects.toThrow(
        DatabaseError
      );
    });
  });
});

describe("deleteLanguage", () => {
  beforeEach(() => {
    vi.mocked(getProject).mockResolvedValue(fakeProject);
  });

  test("happy path deletes a language", async () => {
    vi.mocked(prisma.language.delete).mockResolvedValue(mockLanguage);
    const result = await deleteLanguage(mockLanguageId, mockProjectId);
    expect(result).toEqual(mockLanguage);
  });

  describe("sad path", () => {
    testInputValidation(deleteLanguage, "bad-id", mockProjectId);

    test("throws DatabaseError on PrismaKnownRequestError", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "1",
      });
      vi.mocked(prisma.language.delete).mockRejectedValue(err);
      await expect(deleteLanguage(mockLanguageId, mockProjectId)).rejects.toThrow(DatabaseError);
    });
  });
});
