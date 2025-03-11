import { getIsAIEnabled } from "@/modules/ee/license-check/lib/utils";
import { handleTriggerUpdates } from "@/modules/survey/editor/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getOrganizationAIKeys, getOrganizationIdFromEnvironmentId } from "@/modules/survey/lib/organization";
import { getSurvey, selectSurvey } from "@/modules/survey/lib/survey";
import { getInsightsEnabled } from "@/modules/survey/lib/utils";
import { doesSurveyHasOpenTextQuestion } from "@/modules/survey/lib/utils";
import { Prisma, Survey } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey, TSurveyOpenTextQuestion } from "@formbricks/types/surveys/types";

export const updateSurvey = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  try {
    const surveyId = updatedSurvey.id;
    let data: any = {};

    const actionClasses = await getActionClasses(updatedSurvey.environmentId);
    const currentSurvey = await getSurvey(surveyId);

    if (!currentSurvey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const { triggers, environmentId, segment, questions, languages, type, followUps, ...surveyData } =
      updatedSurvey;

    if (languages) {
      // Process languages update logic here
      // Extract currentLanguageIds and updatedLanguageIds
      const currentLanguageIds = currentSurvey.languages
        ? currentSurvey.languages.map((l) => l.language.id)
        : [];
      const updatedLanguageIds =
        languages.length > 1 ? updatedSurvey.languages.map((l) => l.language.id) : [];
      const enabledLanguageIds = languages.map((language) => {
        if (language.enabled) return language.language.id;
      });

      // Determine languages to add and remove
      const languagesToAdd = updatedLanguageIds.filter((id) => !currentLanguageIds.includes(id));
      const languagesToRemove = currentLanguageIds.filter((id) => !updatedLanguageIds.includes(id));

      const defaultLanguageId = updatedSurvey.languages.find((l) => l.default)?.language.id;

      // Prepare data for Prisma update
      data.languages = {};

      // Update existing languages for default value changes
      data.languages.updateMany = currentSurvey.languages.map((surveyLanguage) => ({
        where: { languageId: surveyLanguage.language.id },
        data: {
          default: surveyLanguage.language.id === defaultLanguageId,
          enabled: enabledLanguageIds.includes(surveyLanguage.language.id),
        },
      }));

      // Add new languages
      if (languagesToAdd.length > 0) {
        data.languages.create = languagesToAdd.map((languageId) => ({
          languageId: languageId,
          default: languageId === defaultLanguageId,
          enabled: enabledLanguageIds.includes(languageId),
        }));
      }

      // Remove languages no longer associated with the survey
      if (languagesToRemove.length > 0) {
        data.languages.deleteMany = languagesToRemove.map((languageId) => ({
          languageId: languageId,
          enabled: enabledLanguageIds.includes(languageId),
        }));
      }
    }

    if (triggers) {
      data.triggers = handleTriggerUpdates(triggers, currentSurvey.triggers, actionClasses);
    }

    // if the survey body has type other than "app" but has a private segment, we delete that segment, and if it has a public segment, we disconnect from to the survey
    if (segment) {
      if (type === "app") {
        // parse the segment filters:
        const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
        if (!parsedFilters.success) {
          throw new InvalidInputError("Invalid user segment filters");
        }

        try {
          // update the segment:
          let updatedInput: Prisma.SegmentUpdateInput = {
            ...segment,
            surveys: undefined,
          };

          if (segment.surveys) {
            updatedInput = {
              ...segment,
              surveys: {
                connect: segment.surveys.map((surveyId) => ({ id: surveyId })),
              },
            };
          }

          const updatedSegment = await prisma.segment.update({
            where: { id: segment.id },
            data: updatedInput,
            select: {
              surveys: { select: { id: true } },
              environmentId: true,
              id: true,
            },
          });

          segmentCache.revalidate({ id: updatedSegment.id, environmentId: updatedSegment.environmentId });
          updatedSegment.surveys.map((survey) => surveyCache.revalidate({ id: survey.id }));
        } catch (error) {
          logger.error(error);
          throw new Error("Error updating survey");
        }
      } else {
        if (segment.isPrivate) {
          // disconnect the private segment first and then delete:
          await prisma.segment.update({
            where: { id: segment.id },
            data: {
              surveys: {
                disconnect: {
                  id: surveyId,
                },
              },
            },
          });

          // delete the private segment:
          await prisma.segment.delete({
            where: {
              id: segment.id,
            },
          });
        } else {
          await prisma.survey.update({
            where: {
              id: surveyId,
            },
            data: {
              segment: {
                disconnect: true,
              },
            },
          });
        }
      }

      segmentCache.revalidate({
        id: segment.id,
        environmentId: segment.environmentId,
      });
    } else if (type === "app") {
      if (!currentSurvey.segment) {
        await prisma.survey.update({
          where: {
            id: surveyId,
          },
          data: {
            segment: {
              connectOrCreate: {
                where: {
                  environmentId_title: {
                    environmentId,
                    title: surveyId,
                  },
                },
                create: {
                  title: surveyId,
                  isPrivate: true,
                  filters: [],
                  environment: {
                    connect: {
                      id: environmentId,
                    },
                  },
                },
              },
            },
          },
        });

        segmentCache.revalidate({
          environmentId,
        });
      }
    }

    if (followUps) {
      // Separate follow-ups into categories based on deletion flag
      const deletedFollowUps = followUps.filter((followUp) => followUp.deleted);
      const nonDeletedFollowUps = followUps.filter((followUp) => !followUp.deleted);

      // Get set of existing follow-up IDs from currentSurvey
      const existingFollowUpIds = new Set(currentSurvey.followUps.map((f) => f.id));

      // Separate non-deleted follow-ups into new and existing
      const existingFollowUps = nonDeletedFollowUps.filter((followUp) =>
        existingFollowUpIds.has(followUp.id)
      );
      const newFollowUps = nonDeletedFollowUps.filter((followUp) => !existingFollowUpIds.has(followUp.id));

      data.followUps = {
        // Update existing follow-ups
        updateMany: existingFollowUps.map((followUp) => ({
          where: {
            id: followUp.id,
          },
          data: {
            name: followUp.name,
            trigger: followUp.trigger,
            action: followUp.action,
          },
        })),
        // Create new follow-ups
        createMany:
          newFollowUps.length > 0
            ? {
                data: newFollowUps.map((followUp) => ({
                  name: followUp.name,
                  trigger: followUp.trigger,
                  action: followUp.action,
                })),
              }
            : undefined,
        // Delete follow-ups marked as deleted, regardless of whether they exist in DB
        deleteMany:
          deletedFollowUps.length > 0
            ? deletedFollowUps.map((followUp) => ({
                id: followUp.id,
              }))
            : undefined,
      };
    }

    data.questions = questions.map((question) => {
      const { isDraft, ...rest } = question;
      return rest;
    });

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
        const currentSurveyOpenTextQuestions = currentSurvey.questions?.filter(
          (question) => question.type === "openText"
        );

        // find the questions that have been updated or added
        const questionsToCheckForInsights: Survey["questions"] = [];

        for (const question of openTextQuestions) {
          const existingQuestion = currentSurveyOpenTextQuestions?.find((ques) => ques.id === question.id) as
            | TSurveyOpenTextQuestion
            | undefined;
          const isExistingQuestion = !!existingQuestion;

          if (
            isExistingQuestion &&
            question.headline.default === existingQuestion.headline.default &&
            existingQuestion.insightsEnabled !== undefined
          ) {
            continue;
          } else {
            questionsToCheckForInsights.push(question);
          }
        }

        if (questionsToCheckForInsights.length > 0) {
          const insightsEnabledValues = await Promise.all(
            questionsToCheckForInsights.map(async (question) => {
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
    } else {
      // check if an existing question got changed that had insights enabled
      const insightsEnabledOpenTextQuestions = currentSurvey.questions?.filter(
        (question) => question.type === "openText" && question.insightsEnabled !== undefined
      );
      // if question headline changed, remove insightsEnabled
      for (const question of insightsEnabledOpenTextQuestions) {
        const updatedQuestion = data.questions?.find((q) => q.id === question.id);
        if (updatedQuestion && updatedQuestion.headline.default !== question.headline.default) {
          updatedQuestion.insightsEnabled = undefined;
        }
      }
    }

    surveyData.updatedAt = new Date();

    data = {
      ...surveyData,
      ...data,
      type,
    };

    // Remove scheduled status when runOnDate is not set
    if (data.status === "scheduled" && data.runOnDate === null) {
      data.status = "inProgress";
    }
    // Set scheduled status when runOnDate is set and in the future on completed surveys
    if (
      (data.status === "completed" || data.status === "paused" || data.status === "inProgress") &&
      data.runOnDate &&
      data.runOnDate > new Date()
    ) {
      data.status = "scheduled";
    }

    delete data.createdBy;
    const prismaSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data,
      select: selectSurvey,
    });

    let surveySegment: TSegment | null = null;
    if (prismaSurvey.segment) {
      surveySegment = {
        ...prismaSurvey.segment,
        surveys: prismaSurvey.segment.surveys.map((survey) => survey.id),
      };
    }

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const modifiedSurvey: TSurvey = {
      ...prismaSurvey, // Properties from prismaSurvey
      displayPercentage: Number(prismaSurvey.displayPercentage) || null,
      segment: surveySegment,
    };

    surveyCache.revalidate({
      id: modifiedSurvey.id,
      environmentId: modifiedSurvey.environmentId,
      segmentId: modifiedSurvey.segment?.id,
      resultShareKey: currentSurvey.resultShareKey ?? undefined,
    });

    return modifiedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error);
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
