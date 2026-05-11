import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getProject, getUserProjects } from "@/lib/project/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { deleteProject } from "@/modules/projects/settings/lib/project";
import {
  WORKSPACE_DELETE_CONFIRMATION_ERROR,
  hasMatchingWorkspaceDeleteConfirmation,
} from "./delete-project-confirmation";

const ZProjectDeleteAction = z.object({
  projectId: ZId,
  confirmationName: z.string().trim().min(1),
});

export const DELETE_PROJECT_CONFIRMATION_REQUIRED_ERROR =
  "Workspace name confirmation is required to delete this workspace.";

export const parseProjectDeleteActionInput = (input: unknown) => {
  const parsedInput = ZProjectDeleteAction.safeParse(input);

  if (!parsedInput.success) {
    throw new InvalidInputError(DELETE_PROJECT_CONFIRMATION_REQUIRED_ERROR);
  }

  return parsedInput.data;
};

export const getProjectIdForLogging = (input: unknown) => {
  if (typeof input !== "object" || input === null || !("projectId" in input)) {
    return "unknown";
  }

  const projectId = input.projectId;

  return typeof projectId === "string" ? projectId : "unknown";
};

const assertMatchingWorkspaceDeleteConfirmation = (confirmationName: string, workspaceName: string) => {
  if (!hasMatchingWorkspaceDeleteConfirmation(confirmationName, workspaceName)) {
    throw new InvalidInputError(WORKSPACE_DELETE_CONFIRMATION_ERROR);
  }
};

interface DeleteProjectWithConfirmationParams {
  input: unknown;
  userId: string;
  auditLoggingCtx: {
    organizationId?: string;
    projectId?: string;
    oldObject?: unknown;
  };
}

export const deleteProjectWithConfirmation = async ({
  input,
  userId,
  auditLoggingCtx,
}: DeleteProjectWithConfirmationParams) => {
  const { confirmationName, projectId } = parseProjectDeleteActionInput(input);
  const project = await getProject(projectId);

  if (!project) {
    throw new ResourceNotFoundError("project", projectId);
  }

  assertMatchingWorkspaceDeleteConfirmation(confirmationName, project.name);

  const organizationId = project.organizationId;

  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
    ],
  });

  const availableProjects = await getUserProjects(userId, organizationId);

  if (availableProjects.length <= 1) {
    throw new OperationNotAllowedError("You can't delete the last project in the environment.");
  }

  auditLoggingCtx.organizationId = organizationId;
  auditLoggingCtx.projectId = projectId;
  auditLoggingCtx.oldObject = project;

  return await deleteProject(projectId);
};
