import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ActionClass, Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError, UniqueConstraintError } from "@formbricks/types/errors";
import { createActionClass } from "./action-class";

vi.mock("@formbricks/database", () => ({
  prisma: {
    actionClass: {
      create: vi.fn(),
    },
  },
  PrismaErrorType: {
    UniqueConstraintViolation: "P2002",
  },
}));

const mockWorkspaceId = "test-workspace-id";

const mockCodeActionInput: TActionClassInput = {
  name: "Test Code Action",
  description: "This is a test code action",
  type: "code",
  key: "test-code-action-key",
  workspaceId: mockWorkspaceId,
};

const mockNoCodeActionInput: TActionClassInput = {
  name: "Test No Code Action",
  description: "This is a test no code action",
  type: "noCode",
  noCodeConfig: {
    type: "click",
    elementSelector: { cssSelector: ".btn" },
    urlFilters: [],
  },
  workspaceId: mockWorkspaceId,
};

const mockActionClass: ActionClass = {
  id: "test-action-class-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Action",
  description: "This is a test action",
  type: "code",
  key: "test-action-key",
  noCodeConfig: null,
  workspaceId: mockWorkspaceId,
};

describe("createActionClass", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should create a code action class successfully", async () => {
    const createdAction = { ...mockActionClass, ...mockCodeActionInput, noCodeConfig: null };
    vi.mocked(prisma.actionClass.create).mockResolvedValue(createdAction);

    const result = await createActionClass(mockWorkspaceId, mockCodeActionInput);

    expect(prisma.actionClass.create).toHaveBeenCalledWith({
      data: {
        name: mockCodeActionInput.name,
        description: mockCodeActionInput.description,
        type: "code",
        key: mockCodeActionInput.key,
        workspace: { connect: { id: mockWorkspaceId } },
        noCodeConfig: undefined,
      },
    });
    expect(result).toEqual(createdAction);
  });

  test("should create a no-code action class successfully", async () => {
    const createdAction = {
      ...mockActionClass,
      ...mockNoCodeActionInput,
      key: null,
      noCodeConfig: mockNoCodeActionInput.noCodeConfig,
    };
    vi.mocked(prisma.actionClass.create).mockResolvedValue(createdAction);

    const result = await createActionClass(mockWorkspaceId, mockNoCodeActionInput);

    expect(prisma.actionClass.create).toHaveBeenCalledWith({
      data: {
        name: mockNoCodeActionInput.name,
        description: mockNoCodeActionInput.description,
        type: "noCode",
        key: undefined,
        workspace: { connect: { id: mockWorkspaceId } },
        noCodeConfig: mockNoCodeActionInput.noCodeConfig,
      },
    });
    expect(result).toEqual(createdAction);
  });

  test("should throw UniqueConstraintError for unique constraint violation", async () => {
    const prismaError = Object.assign(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "test",
      }),
      { meta: { target: ["name"] } }
    );
    vi.mocked(prisma.actionClass.create).mockRejectedValue(prismaError);

    await expect(createActionClass(mockWorkspaceId, mockCodeActionInput)).rejects.toThrow(
      UniqueConstraintError
    );
  });

  test("should throw DatabaseError for other database errors", async () => {
    const genericError = new Error("Some database error");
    vi.mocked(prisma.actionClass.create).mockRejectedValue(genericError);

    await expect(createActionClass(mockWorkspaceId, mockCodeActionInput)).rejects.toThrow(DatabaseError);
  });
});
