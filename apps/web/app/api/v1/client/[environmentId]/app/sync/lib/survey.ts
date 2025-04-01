import "server-only";
import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { displayCache } from "@formbricks/lib/display/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { getSurveys } from "@formbricks/lib/survey/service";
import { diffInDays } from "@formbricks/lib/utils/datetime";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getSyncSurveys = reactCache(
  (environmentId: string, contactId: string): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
          const product = await getProjectByEnvironmentId(environmentId);

          if (!product) {
            throw new Error("Product not found");
          }

          let surveys = await getSurveys(environmentId);

          // filtered surveys for running and web
          surveys = surveys.filter((survey) => survey.status === "inProgress" && survey.type === "app");

          // if no surveys are left, return an empty array
          if (surveys.length === 0) {
            return [];
          }

          const displays = await prisma.display.findMany({
            where: {
              contactId,
            },
          });

          const responses = await prisma.response.findMany({
            where: {
              contactId,
            },
          });

          // filter surveys that meet the displayOption criteria
          surveys = surveys.filter((survey) => {
            switch (survey.displayOption) {
              case "respondMultiple":
                return true;
              case "displayOnce":
                return displays.filter((display) => display.surveyId === survey.id).length === 0;
              case "displayMultiple":
                if (!responses) return true;
                else {
                  return responses.filter((response) => response.surveyId === survey.id).length === 0;
                }
              case "displaySome":
                if (survey.displayLimit === null) {
                  return true;
                }

                if (
                  responses &&
                  responses.filter((response) => response.surveyId === survey.id).length !== 0
                ) {
                  return false;
                }

                return (
                  displays.filter((display) => display.surveyId === survey.id).length < survey.displayLimit
                );
              default:
                throw Error("Invalid displayOption");
            }
          });

          const latestDisplay = displays[0];

          // filter surveys that meet the recontactDays criteria
          surveys = surveys.filter((survey) => {
            if (!latestDisplay) {
              return true;
            } else if (survey.recontactDays !== null) {
              const lastDisplaySurvey = displays.filter((display) => display.surveyId === survey.id)[0];
              if (!lastDisplaySurvey) {
                return true;
              }
              return diffInDays(new Date(), new Date(lastDisplaySurvey.createdAt)) >= survey.recontactDays;
            } else if (product.recontactDays !== null) {
              return diffInDays(new Date(), new Date(latestDisplay.createdAt)) >= product.recontactDays;
            } else {
              return true;
            }
          });

          // if no surveys are left, return an empty array
          if (surveys.length === 0) {
            return [];
          }

          return surveys;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error);
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getSyncSurveys-${environmentId}-${contactId}`],
      {
        tags: [
          contactCache.tag.byEnvironmentId(environmentId),
          contactCache.tag.byId(contactId),
          displayCache.tag.byContactId(contactId),
          surveyCache.tag.byEnvironmentId(environmentId),
          projectCache.tag.byEnvironmentId(environmentId),
          contactAttributeCache.tag.byContactId(contactId),
        ],
      }
    )()
);
