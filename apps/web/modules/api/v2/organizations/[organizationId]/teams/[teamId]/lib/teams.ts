import { teamCache } from "@/lib/cache/team";
import { ZTeamUpdateSchema } from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/types/teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Team } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { cache } from "@formbricks/lib/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getTeam = reactCache(async (organizationId: string, teamId: string) =>
  cache(
    async (): Promise<Result<Team, ApiErrorResponseV2>> => {
      try {
        const responsePrisma = await prisma.team.findUnique({
          where: {
            id: teamId,
            organizationId,
          },
        });

        if (!responsePrisma) {
          return err({ type: "not_found", details: [{ field: "team", issue: "not found" }] });
        }

        return ok(responsePrisma);
      } catch (error) {
        return err({
          type: "internal_server_error",
          details: [{ field: "team", issue: error.message }],
        });
      }
    },
    [`organization-${organizationId}-getTeam-${teamId}`],
    {
      tags: [teamCache.tag.byId(teamId)],
    }
  )()
);

export const deleteTeam = async (
  organizationId,
  teamId: string
): Promise<Result<Team, ApiErrorResponseV2>> => {
  try {
    const deletedTeam = await prisma.team.delete({
      where: {
        id: teamId,
        organizationId,
      },
      include: {
        projectTeams: {
          select: {
            projectId: true,
          },
        },
      },
    });

    teamCache.revalidate({
      id: deletedTeam.id,
      organizationId: deletedTeam.organizationId,
    });

    for (const projectTeam of deletedTeam.projectTeams) {
      teamCache.revalidate({
        projectId: projectTeam.projectId,
      });
    }

    return ok(deletedTeam);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "team", issue: "not found" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "team", issue: error.message }],
    });
  }
};

export const updateTeam = async (
  organizationId,
  teamId: string,
  teamInput: z.infer<typeof ZTeamUpdateSchema>
): Promise<Result<Team, ApiErrorResponseV2>> => {
  try {
    const updatedTeam = await prisma.team.update({
      where: {
        id: teamId,
        organizationId,
      },
      data: teamInput,
      include: {
        projectTeams: { select: { projectId: true } },
      },
    });

    teamCache.revalidate({
      id: updatedTeam.id,
      organizationId: updatedTeam.organizationId,
    });

    for (const projectTeam of updatedTeam.projectTeams) {
      teamCache.revalidate({
        projectId: projectTeam.projectId,
      });
    }

    return ok(updatedTeam);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "team", issue: "not found" }],
        });
      }
    }
    return err({
      type: "internal_server_error",
      details: [{ field: "team", issue: error.message }],
    });
  }
};
