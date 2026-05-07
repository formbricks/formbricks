import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { deleteProjectAction } from "./actions";

const mocks = vi.hoisted(() => ({
  deleteProjectWithConfirmation: vi.fn(),
  getProjectIdForLogging: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("./lib/delete-project", () => ({
  deleteProjectWithConfirmation: mocks.deleteProjectWithConfirmation,
  getProjectIdForLogging: mocks.getProjectIdForLogging,
}));

const baseProject = {
  id: "cmproject000000000000000000",
  name: "Acme Workspace",
  organizationId: "cmorg00000000000000000000",
};

const ctx = {
  user: {
    id: "cmuser00000000000000000000",
  },
  auditLoggingCtx: {},
};

describe("deleteProjectAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectIdForLogging.mockReturnValue(baseProject.id);
    mocks.deleteProjectWithConfirmation.mockResolvedValue(baseProject);
  });

  test("delegates workspace deletion to the covered lib", async () => {
    const parsedInput = {
      projectId: baseProject.id,
      confirmationName: "acme workspace",
    };

    const result = await deleteProjectAction({
      ctx,
      parsedInput,
    } as any);

    expect(mocks.getProjectIdForLogging).toHaveBeenCalledWith(parsedInput);
    expect(mocks.deleteProjectWithConfirmation).toHaveBeenCalledWith({
      input: parsedInput,
      userId: ctx.user.id,
      auditLoggingCtx: ctx.auditLoggingCtx,
    });
    expect(result).toEqual(baseProject);
  });

  test("logs and rethrows deletion failures", async () => {
    const error = new Error("delete failed");
    mocks.deleteProjectWithConfirmation.mockRejectedValueOnce(error);

    await expect(
      deleteProjectAction({
        ctx,
        parsedInput: {
          projectId: baseProject.id,
          confirmationName: baseProject.name,
        },
      } as any)
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      { error, userId: ctx.user.id, projectId: baseProject.id },
      "Workspace deletion failed"
    );
  });

  test("does not error-log expected deletion failures", async () => {
    const error = new InvalidInputError("Workspace name confirmation does not match");
    mocks.deleteProjectWithConfirmation.mockRejectedValueOnce(error);

    await expect(
      deleteProjectAction({
        ctx,
        parsedInput: {
          projectId: baseProject.id,
          confirmationName: "Other Workspace",
        },
      } as any)
    ).rejects.toThrow(error);

    expect(logger.error).not.toHaveBeenCalled();
  });
});
