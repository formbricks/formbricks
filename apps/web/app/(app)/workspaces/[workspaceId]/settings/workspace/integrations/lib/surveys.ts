import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { validateInputs } from "@/lib/utils/validate";

/**
 * The surveys an integration picker offers the signed-in user. The visibility clause is resolved here
 * rather than passed in (ENG-3282), so no page can list a restricted survey the user cannot see by
 * forgetting it: a plain member gets workspace-visible surveys plus their own restricted ones.
 */
export const getSurveys = reactCache(
  async (workspaceId: string, userId: string, organizationId: string): Promise<TSurvey[]> => {
    validateInputs([workspaceId, ZId], [userId, ZId], [organizationId, ZId]);

    try {
      const visibleSurveyWhere = await getUserVisibleSurveyWhere(userId, organizationId);
      const surveysPrisma = await prisma.survey.findMany({
        where: {
          workspaceId,
          status: {
            not: "completed",
          },
          // Archived surveys must not be selectable as integration targets.
          archivedAt: null,
          ...andVisibleSurveys(visibleSurveyWhere),
        },
        select: selectSurvey,
        orderBy: {
          updatedAt: "desc",
        },
      });

      return surveysPrisma.map((surveyPrisma) => transformPrismaSurvey<TSurvey>(surveyPrisma));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error({ error }, "getSurveys: Could not fetch surveys");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
