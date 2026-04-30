import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TActionClass, TActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError, ResourceNotFoundError, UniqueConstraintError } from "@formbricks/types/errors";
import {
  createActionClass,
  deleteActionClass,
  getActionClass,
  getActionClassByEnvironmentIdAndName,
  getActionClasses,
  updateActionClass,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    actionClass: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("ActionClass Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getActionClasses", () => {
    test("should return action classes for environment", async () => {
      const mockActionClasses: TActionClass[] = [
        {
          id: "id1",
          createdAt: new Date(),
          updatedAt: new Date(),
          name: "Action 1",
          description: "desc",
          type: "code",
          key: "key1",
          noCodeConfig: null,
          environmentId: "env1",
        },
      ];
      vi.mocked(prisma.actionClass.findMany).mockResolvedValue(mockActionClasses);

      const result = await getActionClasses("env1");
      expect(result).toEqual(mockActionClasses);
      expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
        where: { environmentId: "env1" },
        select: expect.any(Object),
        take: undefined,
        skip: undefined,
        orderBy: { createdAt: "asc" },
      });
    });

    test("should throw DatabaseError when prisma throws", async () => {
      vi.mocked(prisma.actionClass.findMany).mockRejectedValue(new Error("fail"));
      await expect(getActionClasses("env1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getActionClassByEnvironmentIdAndName", () => {
    test("should return action class when found", async () => {
      const mockActionClass: TActionClass = {
        id: "id2",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Action 2",
        description: "desc2",
        type: "noCode",
        key: null,
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "button" },
          urlFilters: [],
        },
        environmentId: "env2",
      };
      if (!prisma.actionClass.findFirst) prisma.actionClass.findFirst = vi.fn();
      vi.mocked(prisma.actionClass.findFirst).mockResolvedValue(mockActionClass);

      const result = await getActionClassByEnvironmentIdAndName("env2", "Action 2");
      expect(result).toEqual(mockActionClass);
      expect(prisma.actionClass.findFirst).toHaveBeenCalledWith({
        where: { name: "Action 2", environmentId: "env2" },
        select: expect.any(Object),
      });
    });

    test("should return null when not found", async () => {
      if (!prisma.actionClass.findFirst) prisma.actionClass.findFirst = vi.fn();
      vi.mocked(prisma.actionClass.findFirst).mockResolvedValue(null);
      const result = await getActionClassByEnvironmentIdAndName("env2", "Action 2");
      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      if (!prisma.actionClass.findFirst) prisma.actionClass.findFirst = vi.fn();
      vi.mocked(prisma.actionClass.findFirst).mockRejectedValue(new Error("fail"));
      await expect(getActionClassByEnvironmentIdAndName("env2", "Action 2")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getActionClass", () => {
    test("should return action class when found", async () => {
      const mockActionClass: TActionClass = {
        id: "id3",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Action 3",
        description: "desc3",
        type: "code",
        key: "key3",
        noCodeConfig: null,
        environmentId: "env3",
      };
      if (!prisma.actionClass.findUnique) prisma.actionClass.findUnique = vi.fn();
      vi.mocked(prisma.actionClass.findUnique).mockResolvedValue(mockActionClass);
      const result = await getActionClass("id3");
      expect(result).toEqual(mockActionClass);
      expect(prisma.actionClass.findUnique).toHaveBeenCalledWith({
        where: { id: "id3" },
        select: expect.any(Object),
      });
    });

    test("should return null when not found", async () => {
      if (!prisma.actionClass.findUnique) prisma.actionClass.findUnique = vi.fn();
      vi.mocked(prisma.actionClass.findUnique).mockResolvedValue(null);
      const result = await getActionClass("id3");
      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      if (!prisma.actionClass.findUnique) prisma.actionClass.findUnique = vi.fn();
      vi.mocked(prisma.actionClass.findUnique).mockRejectedValue(new Error("fail"));
      await expect(getActionClass("id3")).rejects.toThrow(DatabaseError);
    });
  });

  describe("deleteActionClass", () => {
    test("should delete and return action class", async () => {
      const mockActionClass: TActionClass = {
        id: "id4",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Action 4",
        description: null,
        type: "code",
        key: "key4",
        noCodeConfig: null,
        environmentId: "env4",
      };
      if (!prisma.actionClass.delete) prisma.actionClass.delete = vi.fn();
      vi.mocked(prisma.actionClass.delete).mockResolvedValue(mockActionClass);
      const result = await deleteActionClass("id4");
      expect(result).toEqual(mockActionClass);
      expect(prisma.actionClass.delete).toHaveBeenCalledWith({
        where: { id: "id4" },
        select: expect.any(Object),
      });
    });

    test("should throw ResourceNotFoundError if action class is null", async () => {
      if (!prisma.actionClass.delete) prisma.actionClass.delete = vi.fn();
      vi.mocked(prisma.actionClass.delete).mockResolvedValue(null as unknown as TActionClass);
      await expect(deleteActionClass("id4")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should rethrow unknown errors", async () => {
      if (!prisma.actionClass.delete) prisma.actionClass.delete = vi.fn();
      const error = new Error("unknown");
      vi.mocked(prisma.actionClass.delete).mockRejectedValue(error);
      await expect(deleteActionClass("id4")).rejects.toThrow("unknown");
    });
  });

  describe("createActionClass", () => {
    const codeInput: TActionClassInput = {
      name: "Code Action",
      description: "desc",
      type: "code",
      key: "code-action-key",
      environmentId: "env-create",
    };

    const buildPrismaUniqueError = (target: string[]) =>
      Object.assign(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: PrismaErrorType.UniqueConstraintViolation,
          clientVersion: "test",
        }),
        { meta: { target } }
      );

    test("should create and return the action class", async () => {
      const created: TActionClass = {
        id: "id-create",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: codeInput.name,
        description: codeInput.description ?? null,
        type: "code",
        key: codeInput.type === "code" ? codeInput.key : null,
        noCodeConfig: null,
        environmentId: codeInput.environmentId,
      };
      vi.mocked(prisma.actionClass.create).mockResolvedValue(created as never);

      const result = await createActionClass(codeInput.environmentId, codeInput);
      expect(result).toEqual(created);
    });

    test("should throw UniqueConstraintError on P2002 with target field", async () => {
      vi.mocked(prisma.actionClass.create).mockRejectedValue(buildPrismaUniqueError(["name"]));

      await expect(createActionClass(codeInput.environmentId, codeInput)).rejects.toThrow(
        UniqueConstraintError
      );
      await expect(createActionClass(codeInput.environmentId, codeInput)).rejects.toThrow(
        `Action with name ${codeInput.name} already exists`
      );
    });

    test("should throw UniqueConstraintError on P2002 even when target is missing", async () => {
      vi.mocked(prisma.actionClass.create).mockRejectedValue(
        Object.assign(
          new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: PrismaErrorType.UniqueConstraintViolation,
            clientVersion: "test",
          }),
          { meta: undefined }
        )
      );

      await expect(createActionClass(codeInput.environmentId, codeInput)).rejects.toThrow(
        UniqueConstraintError
      );
    });

    test("should throw DatabaseError for non-P2002 errors", async () => {
      vi.mocked(prisma.actionClass.create).mockRejectedValue(new Error("boom"));

      await expect(createActionClass(codeInput.environmentId, codeInput)).rejects.toThrow(DatabaseError);
      await expect(createActionClass(codeInput.environmentId, codeInput)).rejects.toThrow(
        `Database error when creating an action for environment ${codeInput.environmentId}`
      );
    });
  });

  describe("updateActionClass", () => {
    const updateInput: Partial<TActionClassInput> = {
      name: "Renamed Action",
      description: "updated desc",
      type: "code",
      key: "renamed-key",
      environmentId: "env-update",
    };

    const buildPrismaUniqueError = (target: string[]) =>
      Object.assign(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: PrismaErrorType.UniqueConstraintViolation,
          clientVersion: "test",
        }),
        { meta: { target } }
      );

    test("should update and return the action class", async () => {
      const updated = {
        id: "id-update",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: updateInput.name,
        description: updateInput.description ?? null,
        type: "code" as const,
        key: "renamed-key",
        noCodeConfig: null,
        environmentId: updateInput.environmentId,
        surveyTriggers: [],
      };
      vi.mocked(prisma.actionClass.update).mockResolvedValue(updated as never);

      const result = await updateActionClass(updateInput.environmentId!, "id-update", updateInput);
      expect(result).toEqual(updated);
    });

    test("should throw UniqueConstraintError on P2002 with target field", async () => {
      vi.mocked(prisma.actionClass.update).mockRejectedValue(buildPrismaUniqueError(["name"]));

      await expect(updateActionClass(updateInput.environmentId!, "id-update", updateInput)).rejects.toThrow(
        UniqueConstraintError
      );
      await expect(updateActionClass(updateInput.environmentId!, "id-update", updateInput)).rejects.toThrow(
        `Action with name ${updateInput.name} already exists`
      );
    });

    test("should throw DatabaseError for other PrismaClientKnownRequestError codes", async () => {
      vi.mocked(prisma.actionClass.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "test",
        })
      );

      await expect(updateActionClass(updateInput.environmentId!, "id-update", updateInput)).rejects.toThrow(
        DatabaseError
      );
    });

    test("should rethrow unknown errors", async () => {
      vi.mocked(prisma.actionClass.update).mockRejectedValue(new Error("boom"));

      await expect(updateActionClass(updateInput.environmentId!, "id-update", updateInput)).rejects.toThrow(
        "boom"
      );
    });
  });
});
