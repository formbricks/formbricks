import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { transformPrismaSurvey } from "@formbricks/lib/survey/utils";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getSurvey = reactCache(
  async (surveyId: string): Promise<TSurvey> =>
    cache(
      async () => {
        const survey = await prisma.survey.findUnique({
          where: { id: surveyId },
          select: {
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
          },
        });

        if (!survey) {
          throw new ResourceNotFoundError("Survey", surveyId);
        }

        return transformPrismaSurvey<TSurvey>(survey);
      },
      [`survey-editor-getSurvey-${surveyId}`],
      {
        tags: [surveyCache.tag.byId(surveyId)],
      }
    )()
);
