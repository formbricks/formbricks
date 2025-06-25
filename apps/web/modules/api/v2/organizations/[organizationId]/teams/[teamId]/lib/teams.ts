import { ZTeamUpdateSchema } from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/types/teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Team } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getTeam = reactCache(async (organizationId: string, teamId: string) => {
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
});

export const deleteTeam = async (
  organizationId: string,
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
  organizationId: string,
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
