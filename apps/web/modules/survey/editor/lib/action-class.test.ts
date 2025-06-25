import { ActionClass } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError } from "@formbricks/types/errors";
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

const mockEnvironmentId = "test-environment-id";

const mockCodeActionInput: TActionClassInput = {
  name: "Test Code Action",
  description: "This is a test code action",
  type: "code",
  key: "test-code-action-key",
  environmentId: mockEnvironmentId,
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
  environmentId: mockEnvironmentId,
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
  environmentId: mockEnvironmentId,
};

describe("createActionClass", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should create a code action class successfully", async () => {
    const createdAction = { ...mockActionClass, ...mockCodeActionInput, noCodeConfig: null };
    vi.mocked(prisma.actionClass.create).mockResolvedValue(createdAction);

    const result = await createActionClass(mockEnvironmentId, mockCodeActionInput);

    expect(prisma.actionClass.create).toHaveBeenCalledWith({
      data: {
        name: mockCodeActionInput.name,
        description: mockCodeActionInput.description,
        type: "code",
        key: mockCodeActionInput.key,
        environment: { connect: { id: mockEnvironmentId } },
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

    const result = await createActionClass(mockEnvironmentId, mockNoCodeActionInput);

    expect(prisma.actionClass.create).toHaveBeenCalledWith({
      data: {
        name: mockNoCodeActionInput.name,
        description: mockNoCodeActionInput.description,
        type: "noCode",
        key: undefined,
        environment: { connect: { id: mockEnvironmentId } },
        noCodeConfig: mockNoCodeActionInput.noCodeConfig,
      },
    });
    expect(result).toEqual(createdAction);
  });

  test("should throw DatabaseError for unique constraint violation", async () => {
    const prismaError = {
      code: PrismaErrorType.UniqueConstraintViolation,
      meta: { target: ["name"] },
    };
    vi.mocked(prisma.actionClass.create).mockRejectedValue(prismaError);

    await expect(createActionClass(mockEnvironmentId, mockCodeActionInput)).rejects.toThrow(DatabaseError);
  });

  test("should throw DatabaseError for other database errors", async () => {
    const genericError = new Error("Some database error");
    vi.mocked(prisma.actionClass.create).mockRejectedValue(genericError);

    await expect(createActionClass(mockEnvironmentId, mockCodeActionInput)).rejects.toThrow(DatabaseError);
  });
});
