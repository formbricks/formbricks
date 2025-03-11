import { getIsAIEnabled } from "@/modules/ee/license-check/lib/utils";
import { subscribeOrganizationMembersToSurveyResponses } from "@/modules/survey/components/template-list/lib/organization";
import { handleTriggerUpdates } from "@/modules/survey/components/template-list/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getOrganizationAIKeys, getOrganizationIdFromEnvironmentId } from "@/modules/survey/lib/organization";
import { selectSurvey } from "@/modules/survey/lib/survey";
import { getInsightsEnabled } from "@/modules/survey/lib/utils";
import { doesSurveyHasOpenTextQuestion } from "@/modules/survey/lib/utils";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";

export const createSurvey = async (
  environmentId: string,
  surveyBody: TSurveyCreateInput
): Promise<TSurvey> => {
  try {
    const { createdBy, ...restSurveyBody } = surveyBody;

    // empty languages array
    if (!restSurveyBody.languages?.length) {
      delete restSurveyBody.languages;
    }

    const actionClasses = await getActionClasses(environmentId);

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

    const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
    const organization = await getOrganizationAIKeys(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    //AI Insights
    const isAIEnabled = await getIsAIEnabled(organization);
    if (isAIEnabled) {
      if (doesSurveyHasOpenTextQuestion(data.questions ?? [])) {
        const openTextQuestions = data.questions?.filter((question) => question.type === "openText") ?? [];
        const insightsEnabledValues = await Promise.all(
          openTextQuestions.map(async (question) => {
            const insightsEnabled = await getInsightsEnabled(question);

            return { id: question.id, insightsEnabled };
          })
        );

        data.questions = data.questions?.map((question) => {
          const index = insightsEnabledValues.findIndex((item) => item.id === question.id);
          if (index !== -1) {
            return {
              ...question,
              insightsEnabled: insightsEnabledValues[index].insightsEnabled,
            };
          }

          return question;
        });
      }
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

    const survey = await prisma.survey.create({
      data: {
        ...data,
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
      select: selectSurvey,
    });

    // if the survey created is an "app" survey, we also create a private segment for it.
    if (survey.type === "app") {
      // const newSegment = await createSegment({
      //   environmentId: parsedEnvironmentId,
      //   surveyId: survey.id,
      //   filters: [],
      //   title: survey.id,
      //   isPrivate: true,
      // });

      const newSegment = await prisma.segment.create({
        data: {
          title: survey.id,
          filters: [],
          isPrivate: true,
          environment: {
            connect: {
              id: environmentId,
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

      segmentCache.revalidate({
        id: newSegment.id,
        environmentId: survey.environmentId,
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

    surveyCache.revalidate({
      id: survey.id,
      environmentId: survey.environmentId,
      resultShareKey: survey.resultShareKey ?? undefined,
    });

    if (createdBy) {
      await subscribeOrganizationMembersToSurveyResponses(survey.id, createdBy);
    }

    await capturePosthogEnvironmentEvent(survey.environmentId, "survey created", {
      surveyId: survey.id,
      surveyType: survey.type,
    });

    return transformedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
