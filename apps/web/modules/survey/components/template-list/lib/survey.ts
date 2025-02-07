import { getIsAIEnabled } from "@/modules/ee/license-check/lib/utils";
import { getActionClasses } from "@/modules/survey/components/template-list/components/action-class";
import { getOrganizationAIKeys } from "@/modules/survey/components/template-list/lib/organization";
import { subscribeOrganizationMembersToSurveyResponses } from "@/modules/survey/components/template-list/lib/organization";
import { handleTriggerUpdates } from "@/modules/survey/components/template-list/lib/utils";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { doesSurveyHasOpenTextQuestion, getInsightsEnabled } from "@formbricks/lib/survey/utils";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";

const selectSurvey = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  environmentId: true,
  createdBy: true,
  status: true,
  welcomeCard: true,
  questions: true,
  endings: true,
  hiddenFields: true,
  variables: true,
  displayOption: true,
  recontactDays: true,
  displayLimit: true,
  autoClose: true,
  runOnDate: true,
  closeOnDate: true,
  delay: true,
  displayPercentage: true,
  autoComplete: true,
  isVerifyEmailEnabled: true,
  isSingleResponsePerEmailEnabled: true,
  redirectUrl: true,
  projectOverwrites: true,
  styling: true,
  surveyClosedMessage: true,
  singleUse: true,
  pin: true,
  resultShareKey: true,
  showLanguageSwitch: true,
  languages: {
    select: {
      default: true,
      enabled: true,
      language: {
        select: {
          id: true,
          code: true,
          alias: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
        },
      },
    },
  },
  triggers: {
    select: {
      actionClass: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          environmentId: true,
          name: true,
          description: true,
          type: true,
          key: true,
          noCodeConfig: true,
        },
      },
    },
  },
  segment: {
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  },
  followUps: true,
} satisfies Prisma.SurveySelect;

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

    const organization = await getOrganizationAIKeys(environmentId);
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
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
