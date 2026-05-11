import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import {
  DELETE_PROJECT_CONFIRMATION_REQUIRED_ERROR,
  deleteProjectWithConfirmation,
  getProjectIdForLogging,
} from "./delete-project";
import { WORKSPACE_DELETE_CONFIRMATION_ERROR } from "./delete-project-confirmation";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  deleteProject: vi.fn(),
  getProject: vi.fn(),
  getUserProjects: vi.fn(),
}));

vi.mock("@/lib/project/service", () => ({
  getProject: mocks.getProject,
  getUserProjects: mocks.getUserProjects,
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/modules/projects/settings/lib/project", () => ({
  deleteProject: mocks.deleteProject,
}));

const baseProject = {
  id: "cmproject000000000000000000",
  name: "Acme Workspace",
  organizationId: "cmorg00000000000000000000",
};

const userId = "cmuser00000000000000000000";

const callDeleteProjectWithConfirmation = (input = {}) =>
  deleteProjectWithConfirmation({
    input: {
      projectId: baseProject.id,
      confirmationName: baseProject.name,
      ...input,
    },
    userId,
    auditLoggingCtx: {},
  });

describe("deleteProjectWithConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getProject.mockResolvedValue(baseProject);
    mocks.getUserProjects.mockResolvedValue([baseProject, { ...baseProject, id: "cmproject2" }]);
    mocks.deleteProject.mockResolvedValue(baseProject);
  });

  test("deletes a workspace when the confirmation name matches", async () => {
    const auditLoggingCtx = {};

    const result = await deleteProjectWithConfirmation({
      input: {
        projectId: baseProject.id,
        confirmationName: "acme workspace",
      },
      userId,
      auditLoggingCtx,
    });

    expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId,
      organizationId: baseProject.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });
    expect(mocks.getUserProjects).toHaveBeenCalledWith(userId, baseProject.organizationId);
    expect(mocks.deleteProject).toHaveBeenCalledWith(baseProject.id);
    expect(auditLoggingCtx).toMatchObject({
      organizationId: baseProject.organizationId,
      projectId: baseProject.id,
      oldObject: baseProject,
    });
    expect(result).toEqual(baseProject);
  });

  test("rejects invalid input before any project lookup", async () => {
    await expect(
      deleteProjectWithConfirmation({
        input: {},
        userId,
        auditLoggingCtx: {},
      })
    ).rejects.toThrow(InvalidInputError);
    await expect(
      deleteProjectWithConfirmation({
        input: {},
        userId,
        auditLoggingCtx: {},
      })
    ).rejects.toThrow(DELETE_PROJECT_CONFIRMATION_REQUIRED_ERROR);

    expect(mocks.getProject).not.toHaveBeenCalled();
    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });

  test("does not delete when the confirmation name does not match", async () => {
    const deleteAttempt = callDeleteProjectWithConfirmation({ confirmationName: "Other Workspace" });

    await expect(deleteAttempt).rejects.toThrow(InvalidInputError);
    await expect(deleteAttempt).rejects.toThrow(WORKSPACE_DELETE_CONFIRMATION_ERROR);

    expect(mocks.checkAuthorizationUpdated).not.toHaveBeenCalled();
    expect(mocks.getUserProjects).not.toHaveBeenCalled();
    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });

  test("does not delete when the workspace cannot be found", async () => {
    mocks.getProject.mockResolvedValueOnce(null);

    await expect(callDeleteProjectWithConfirmation()).rejects.toThrow(ResourceNotFoundError);

    expect(mocks.checkAuthorizationUpdated).not.toHaveBeenCalled();
    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });

  test("does not delete when authorization fails", async () => {
    mocks.checkAuthorizationUpdated.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(callDeleteProjectWithConfirmation()).rejects.toThrow(AuthorizationError);

    expect(mocks.getUserProjects).not.toHaveBeenCalled();
    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });

  test("does not delete the last available workspace", async () => {
    mocks.getUserProjects.mockResolvedValueOnce([baseProject]);

    await expect(callDeleteProjectWithConfirmation()).rejects.toThrow(OperationNotAllowedError);

    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });

  test("rethrows downstream delete failures", async () => {
    const error = new Error("delete failed");
    mocks.deleteProject.mockRejectedValueOnce(error);

    await expect(callDeleteProjectWithConfirmation()).rejects.toThrow(error);
  });
});

describe("getProjectIdForLogging", () => {
  test("returns the project id when present", () => {
    expect(getProjectIdForLogging({ projectId: baseProject.id })).toBe(baseProject.id);
  });

  test("returns unknown when the project id is missing or invalid", () => {
    expect(getProjectIdForLogging({})).toBe("unknown");
    expect(getProjectIdForLogging({ projectId: 123 })).toBe("unknown");
    expect(getProjectIdForLogging(null)).toBe("unknown");
  });
});
