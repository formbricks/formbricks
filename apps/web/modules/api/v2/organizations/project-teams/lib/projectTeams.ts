import { teamCache } from "@/lib/cache/team";
import { getProjectTeamsQuery } from "@/modules/api/v2/organizations/project-teams/lib/utils";
import { projectTeamUpdateSchema, TGetProjectTeamsFilter, TProjectTeamInput } from "@/modules/api/v2/organizations/project-teams/types/projectTeams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { prisma } from "@formbricks/database";
import { projectCache } from "@formbricks/lib/project/cache";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { err, ok, Result } from "@formbricks/types/error-handlers";
import { Prisma, ProjectTeam } from "@prisma/client";
import { z } from "zod";

export const getProjectTeams = async (
  params: TGetProjectTeamsFilter
): Promise<Result<ApiResponseWithMeta<ProjectTeam[]>, ApiErrorResponseV2>> => {
  try {
    const [projectTeams, count] = await prisma.$transaction([
      prisma.projectTeam.findMany({
        ...getProjectTeamsQuery(params),
      }),
      prisma.projectTeam.count({
        where: getProjectTeamsQuery(params).where,
      }),
    ]);

    if (!projectTeams) {
      return err({ type: "not_found", details: [{ field: "projectTeam", issue: "not found" }] });
    }

    return ok({
      data: projectTeams,
      meta: {
        total: count,
        limit: params.limit,
        offset: params.skip,
      },
    });
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "projectTeam", issue: error.message }] });
  }
};

export const createProjectTeam = async (
  teamInput: TProjectTeamInput,
): Promise<Result<ProjectTeam, ApiErrorResponseV2>> => {
  captureTelemetry("project team created");

  const { teamId, projectId, permission } = teamInput;

  try {
    const prismaData: Prisma.ProjectTeamCreateInput = {
      team: {
        connect: {
          id: teamId,
        },
      },
        project: {
            connect: {
            id: projectId,
            },
        },
        permission,
    };

    const projectTeam = await prisma.projectTeam.create({
      data: prismaData,
    });

    projectCache.revalidate({
      id: projectId,
    });

    teamCache.revalidate({
        id: teamId,
    });

    return ok(projectTeam);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "projecteam", issue: error.message }] });
  }
};


export const updateProjectTeam = async (
    teamId: string,
    projectId: string,
    teamInput: z.infer<typeof projectTeamUpdateSchema>,
  ): Promise<Result<ProjectTeam, ApiErrorResponseV2>> => {
    try {
        const updatedProjectTeam = await prisma.projectTeam.update({
            where: {
                projectId_teamId: {
                    projectId,
                    teamId,
                }
            },
            data: teamInput,
          });

      projectCache.revalidate({
        id: projectId,
      });
  
      teamCache.revalidate({
          id: teamId,
      });
  
      return ok(projectTeam);
    } catch (error) {
      return err({ type: "internal_server_error", details: [{ field: "projecteam", issue: error.message }] });
    }
  };
  