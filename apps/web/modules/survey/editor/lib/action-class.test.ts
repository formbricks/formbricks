import { ActionClass } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError } from "@formbricks/types/errors";
import { getWorkspaceIdFromEnvironmentId } from "@/lib/utils/helper";
import { createActionClass } from "./action-class";

vi.mock("@/lib/utils/helper", () => ({
  getWorkspaceIdFromEnvironmentId: vi.fn().mockResolvedValue("workspace-id-mock"),
}));

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
const mockWorkspaceId = "test-workspace-id";

const mockCodeActionInput: TActionClassInput = {
  name: "Test Code Action",
  description: "This is a test code action",
  type: "code",
  key: "test-code-action-key",
  environmentId: mockEnvironmentId,
  workspaceId: "test-workspace-id",
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
  workspaceId: "test-workspace-id",
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
  workspaceId: "test-workspace-id",
};

describe("createActionClass", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getWorkspaceIdFromEnvironmentId).mockResolvedValue("workspace-id-mock");
  });

  test("should create a code action class successfully", async () => {
    const createdAction = { ...mockActionClass, ...mockCodeActionInput, noCodeConfig: null };
    vi.mocked(prisma.actionClass.create).mockResolvedValue(createdAction);

    const result = await createActionClass(mockEnvironmentId, mockWorkspaceId, mockCodeActionInput);

    expect(prisma.actionClass.create).toHaveBeenCalledWith({
      data: {
        name: mockCodeActionInput.name,
        description: mockCodeActionInput.description,
        type: "code",
        key: mockCodeActionInput.key,
        environment: { connect: { id: mockEnvironmentId } },
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

    const result = await createActionClass(mockEnvironmentId, mockWorkspaceId, mockNoCodeActionInput);

    expect(prisma.actionClass.create).toHaveBeenCalledWith({
      data: {
        name: mockNoCodeActionInput.name,
        description: mockNoCodeActionInput.description,
        type: "noCode",
        key: undefined,
        environment: { connect: { id: mockEnvironmentId } },
        workspace: { connect: { id: mockWorkspaceId } },
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

    await expect(createActionClass(mockEnvironmentId, mockWorkspaceId, mockCodeActionInput)).rejects.toThrow(
      DatabaseError
    );
  });

  test("should throw DatabaseError for other database errors", async () => {
    const genericError = new Error("Some database error");
    vi.mocked(prisma.actionClass.create).mockRejectedValue(genericError);

    await expect(createActionClass(mockEnvironmentId, mockWorkspaceId, mockCodeActionInput)).rejects.toThrow(
      DatabaseError
    );
  });
});
