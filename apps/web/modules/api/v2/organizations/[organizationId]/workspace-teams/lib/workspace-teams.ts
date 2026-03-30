import { WorkspaceTeam } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getWorkspaceTeamsQuery } from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/lib/utils";
import {
  TGetWorkspaceTeamsFilter,
  TWorkspaceTeamInput,
  ZWorkspaceZTeamUpdateSchema,
} from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/types/workspace-teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";

export const getWorkspaceTeams = async (
  organizationId: string,
  params: TGetWorkspaceTeamsFilter
): Promise<Result<ApiResponseWithMeta<WorkspaceTeam[]>, ApiErrorResponseV2>> => {
  try {
    const query = getWorkspaceTeamsQuery(organizationId, params);

    const [workspaceTeams, count] = await prisma.$transaction([
      prisma.workspaceTeam.findMany({
        ...query,
      }),
      prisma.workspaceTeam.count({
        where: query.where,
      }),
    ]);

    return ok({
      data: workspaceTeams,
      meta: {
        total: count,
        limit: params.limit,
        offset: params.skip,
      },
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "workspaceTeam", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
};

export const createWorkspaceTeam = async (
  teamInput: TWorkspaceTeamInput
): Promise<Result<WorkspaceTeam, ApiErrorResponseV2>> => {
  const { teamId, workspaceId, permission } = teamInput;

  try {
    const workspaceTeam = await prisma.workspaceTeam.create({
      data: {
        teamId,
        workspaceId,
        permission,
      },
    });

    return ok(workspaceTeam);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "workspaceTeam", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
};

export const updateWorkspaceTeam = async (
  teamId: string,
  workspaceId: string,
  teamInput: z.infer<typeof ZWorkspaceZTeamUpdateSchema>
): Promise<Result<WorkspaceTeam, ApiErrorResponseV2>> => {
  try {
    const updatedWorkspaceTeam = await prisma.workspaceTeam.update({
      where: {
        workspaceId_teamId: {
          workspaceId,
          teamId,
        },
      },
      data: teamInput,
    });

    return ok(updatedWorkspaceTeam);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "workspaceTeam", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
};

export const deleteWorkspaceTeam = async (
  teamId: string,
  workspaceId: string
): Promise<Result<WorkspaceTeam, ApiErrorResponseV2>> => {
  try {
    const deletedWorkspaceTeam = await prisma.workspaceTeam.delete({
      where: {
        workspaceId_teamId: {
          workspaceId,
          teamId,
        },
      },
    });

    return ok(deletedWorkspaceTeam);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "workspaceTeam", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
};
