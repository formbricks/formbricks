import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey, TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { getOrganization, subscribeOrganizationMembersToSurveyResponses } from "@/lib/organization/service";
import { validateMediaAndPrepareBlocks } from "@/lib/survey/utils";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { selectSurvey } from "@/modules/survey/lib/survey";
import { handleTriggerUpdates } from "@/modules/survey/lib/trigger-updates";

export const createSurvey = async (workspaceId: string, surveyBody: TSurveyCreateInput): Promise<TSurvey> => {
  try {
    const { createdBy, ...restSurveyBody } = surveyBody;

    // empty languages array
    if (!restSurveyBody.languages?.length) {
      delete restSurveyBody.languages;
    }

    const [organizationId, actionClasses] = await Promise.all([
      getOrganizationIdFromWorkspaceId(workspaceId),
      getActionClasses(workspaceId),
    ]);
    const organization = await getOrganization(organizationId);

    // @ts-expect-error
    let data: Omit<Prisma.SurveyCreateInput, "environment"> = {
      ...restSurveyBody,
      // TODO: Create with attributeFilters
      triggers: restSurveyBody.triggers
        ? handleTriggerUpdates(restSurveyBody.triggers, [], actionClasses)
        : undefined,
      attributeFilters: undefined,
    };

    if (createdBy) {
      data.creator = {
        connect: {
          id: createdBy,
        },
      };
    }
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    // Survey follow-ups
    if (restSurveyBody.followUps?.length) {
      data.followUps = {
        create: restSurveyBody.followUps.map((followUp) => ({
          name: followUp.name,
          trigger: followUp.trigger,
          action: followUp.action,
        })),
      };
    } else {
      delete data.followUps;
    }

    // Validate and prepare blocks
    if (data.blocks && data.blocks.length > 0) {
      data.blocks = validateMediaAndPrepareBlocks(data.blocks);
    }

    const survey = await prisma.survey.create({
      data: {
        ...data,
        workspace: {
          connect: {
            id: workspaceId,
          },
        },
      },
      select: selectSurvey,
    });

    // if the survey created is an "app" survey, we also create a private segment for it.
    if (survey.type === "app") {
      const newSegment = await prisma.segment.create({
        data: {
          title: survey.id,
          filters: [],
          isPrivate: true,
          workspace: {
            connect: {
              id: workspaceId,
            },
          },
        },
      });

      await prisma.survey.update({
        where: {
          id: survey.id,
        },
        data: {
          segment: {
            connect: {
              id: newSegment.id,
            },
          },
        },
      });
    }

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const transformedSurvey: TSurvey = {
      ...survey,
      ...(survey.segment && {
        segment: {
          ...survey.segment,
          surveys: survey.segment.surveys.map((survey) => survey.id),
        },
      }),
    };

    if (createdBy) {
      await subscribeOrganizationMembersToSurveyResponses(survey.id, createdBy, organization.id);
    }

    return transformedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error creating survey");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
