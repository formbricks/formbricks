import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError } from "@formbricks/types/errors";
import { getFeedbackDirectoryAssignmentObjectId } from "@/lib/authzed/feedback-directory-assignment-id";

/**
 * Light, cached lookups the legacy authorization evaluator uses to walk a
 * resource up to the boundary its permission is enforced at (a workspace, an
 * organization). They select only the id needed — never the full record — so
 * an authorization check never over-fetches. They wrap `react.cache` for
 * best-effort request-scoped dedup during Server Component render; they are
 * deliberately NOT cached across requests (`cache.withCache`/Redis) because
 * these are cheap indexed lookups and stale authorization data would be a
 * security bug. Operational failures propagate as `DatabaseError`; a missing
 * record resolves to `null` (a genuine "no such resource", which the evaluator
 * treats as a denial, never an error).
 */

const rethrowAsDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    throw new DatabaseError(error.message);
  }
  throw error;
};

export type TAuthorizationWorkspaceScope = Readonly<{
  organizationId: string;
  workspaceId: string;
}>;

export type TFeedbackDirectoryAuthorizationScope = Readonly<{
  isArchived: boolean;
  organizationId: string;
  workspaceIds: ReadonlyArray<string>;
}>;

export type TFeedbackDirectoryAssignmentAuthorizationScope = Readonly<{
  assignmentId: string;
  organizationId: string;
  workspaceId: string;
}>;

/** Whether a user principal still exists and is active. */
export const isAuthorizationUserActive = reactCache(async (userId: string): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    return user?.isActive === true;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

/** Whether an organization resource still exists. */
export const getAuthorizationOrganizationId = reactCache(
  async (organizationId: string): Promise<string | null> => {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      return organization?.id ?? null;
    } catch (error) {
      return rethrowAsDatabaseError(error);
    }
  }
);

/** The organization a workspace belongs to (`Workspace.organizationId`). */
export const getWorkspaceOrganizationId = reactCache(async (workspaceId: string): Promise<string | null> => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });
    return workspace?.organizationId ?? null;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

/** The workspace and organization a survey belongs to. */
export const getSurveyAuthorizationWorkspaceScope = reactCache(
  async (surveyId: string): Promise<TAuthorizationWorkspaceScope | null> => {
    try {
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        select: {
          workspaceId: true,
          workspace: { select: { organizationId: true } },
        },
      });
      return survey
        ? { organizationId: survey.workspace.organizationId, workspaceId: survey.workspaceId }
        : null;
    } catch (error) {
      return rethrowAsDatabaseError(error);
    }
  }
);

/** The workspace and organization a dashboard belongs to. */
export const getDashboardAuthorizationWorkspaceScope = reactCache(
  async (dashboardId: string): Promise<TAuthorizationWorkspaceScope | null> => {
    try {
      const dashboard = await prisma.dashboard.findUnique({
        where: { id: dashboardId },
        select: {
          workspaceId: true,
          workspace: { select: { organizationId: true } },
        },
      });
      return dashboard
        ? { organizationId: dashboard.workspace.organizationId, workspaceId: dashboard.workspaceId }
        : null;
    } catch (error) {
      return rethrowAsDatabaseError(error);
    }
  }
);

/** The workspace and organization a response's survey belongs to. */
export const getResponseAuthorizationWorkspaceScope = reactCache(
  async (responseId: string): Promise<TAuthorizationWorkspaceScope | null> => {
    try {
      const response = await prisma.response.findUnique({
        where: { id: responseId },
        select: {
          survey: {
            select: {
              workspaceId: true,
              workspace: { select: { organizationId: true } },
            },
          },
        },
      });
      return response
        ? {
            organizationId: response.survey.workspace.organizationId,
            workspaceId: response.survey.workspaceId,
          }
        : null;
    } catch (error) {
      return rethrowAsDatabaseError(error);
    }
  }
);

/** The workspace a survey belongs to (`Survey.workspaceId`). */
export const getSurveyWorkspaceId = reactCache(async (surveyId: string): Promise<string | null> => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { workspaceId: true },
    });
    return survey?.workspaceId ?? null;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

/** The workspace a dashboard belongs to (`Dashboard.workspaceId`). */
export const getDashboardWorkspaceId = reactCache(async (dashboardId: string): Promise<string | null> => {
  try {
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      select: { workspaceId: true },
    });
    return dashboard?.workspaceId ?? null;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

/** The survey a response belongs to (`Response.surveyId`). */
export const getResponseSurveyId = reactCache(async (responseId: string): Promise<string | null> => {
  try {
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      select: { surveyId: true },
    });
    return response?.surveyId ?? null;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

/** The organization a team belongs to (`Team.organizationId`). */
export const getTeamOrganizationId = reactCache(async (teamId: string): Promise<string | null> => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true },
    });
    return team?.organizationId ?? null;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

/** The organization an API key belongs to (`ApiKey.organizationId`). */
export const getApiKeyOrganizationId = reactCache(async (apiKeyId: string): Promise<string | null> => {
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { organizationId: true },
    });
    return apiKey?.organizationId ?? null;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

export const getFeedbackDirectoryAuthorizationScope = reactCache(
  async (feedbackDirectoryId: string): Promise<TFeedbackDirectoryAuthorizationScope | null> => {
    try {
      const directory = await prisma.feedbackDirectory.findUnique({
        where: { id: feedbackDirectoryId },
        select: {
          isArchived: true,
          organizationId: true,
          workspaces: { select: { workspaceId: true }, orderBy: { workspaceId: "asc" } },
        },
      });
      return directory
        ? {
            isArchived: directory.isArchived,
            organizationId: directory.organizationId,
            workspaceIds: directory.workspaces.map(({ workspaceId }) => workspaceId),
          }
        : null;
    } catch (error) {
      return rethrowAsDatabaseError(error);
    }
  }
);

export const getFeedbackDirectoryAssignmentAuthorizationScope = reactCache(
  async (
    feedbackDirectoryId: string,
    workspaceId: string
  ): Promise<TFeedbackDirectoryAssignmentAuthorizationScope | null> => {
    try {
      const assignment = await prisma.feedbackDirectoryWorkspace.findUnique({
        where: {
          feedbackDirectoryId_workspaceId: { feedbackDirectoryId, workspaceId },
        },
        select: {
          feedbackDirectory: { select: { isArchived: true, organizationId: true } },
          workspace: { select: { organizationId: true } },
        },
      });
      if (
        !assignment ||
        assignment.feedbackDirectory.isArchived ||
        assignment.feedbackDirectory.organizationId !== assignment.workspace.organizationId
      ) {
        return null;
      }

      return {
        assignmentId: getFeedbackDirectoryAssignmentObjectId(feedbackDirectoryId, workspaceId),
        organizationId: assignment.feedbackDirectory.organizationId,
        workspaceId,
      };
    } catch (error) {
      return rethrowAsDatabaseError(error);
    }
  }
);

/**
 * Resolve an API key acting as a principal (by `ApiKey.id`) into its effective
 * scopes: per-workspace permissions and organization-level access control. This
 * is the by-id counterpart to `getApiKeyWithPermissions`, which resolves by raw
 * secret during request authentication. Returns `null` if the key is gone.
 */
export const getApiKeyAuthById = reactCache(
  async (apiKeyId: string): Promise<TAuthenticationApiKey | null> => {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: apiKeyId },
        select: {
          id: true,
          organizationId: true,
          organizationAccess: true,
          apiKeyWorkspaces: {
            select: {
              permission: true,
              workspaceId: true,
              workspace: { select: { name: true, organizationId: true } },
            },
          },
        },
      });

      if (!apiKey) return null;

      return {
        type: "apiKey",
        apiKeyId: apiKey.id,
        organizationId: apiKey.organizationId,
        organizationAccess: apiKey.organizationAccess as TAuthenticationApiKey["organizationAccess"],
        workspacePermissions: apiKey.apiKeyWorkspaces
          .filter(
            (workspacePermission) => workspacePermission.workspace.organizationId === apiKey.organizationId
          )
          .map((workspacePermission) => ({
            permission: workspacePermission.permission,
            workspaceId: workspacePermission.workspaceId,
            workspaceName: workspacePermission.workspace.name,
          })),
      };
    } catch (error) {
      return rethrowAsDatabaseError(error);
    }
  }
);
