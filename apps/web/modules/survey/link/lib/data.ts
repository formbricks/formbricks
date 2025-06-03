import "server-only";
import { createCacheKey } from "@/modules/cache/lib/cacheKeys";
import { withCache } from "@/modules/cache/lib/withCache";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Comprehensive survey data fetcher for link surveys
 * Combines all necessary data in a single optimized query
 */
export const getSurveyWithMetadata = reactCache((surveyId: string) =>
  withCache(
    async () => {
      try {
        const survey = await prisma.survey.findUnique({
          where: { id: surveyId },
          select: {
            // Core survey fields
            id: true,
            createdAt: true,
            updatedAt: true,
            name: true,
            type: true,
            environmentId: true,
            createdBy: true,
            status: true,

            // Survey configuration
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

            // Authentication & access
            isVerifyEmailEnabled: true,
            isSingleResponsePerEmailEnabled: true,
            redirectUrl: true,
            pin: true,
            resultShareKey: true,
            isBackButtonHidden: true,

            // Single use configuration
            singleUse: true,

            // Styling & branding
            projectOverwrites: true,
            styling: true,
            surveyClosedMessage: true,
            showLanguageSwitch: true,
            recaptcha: true,

            // Related data
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
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    {
      key: createCacheKey.survey.metadata(surveyId),
      ttl: 60 * 60 * 1000, // 1 hour in milliseconds - surveys change infrequently
    }
  )()
);

/**
 * Lightweight survey metadata for use in generateMetadata()
 * Extracts only needed fields from the cached full survey
 */
export const getSurveyMetadata = async (surveyId: string) => {
  const fullSurvey = await getSurveyWithMetadata(surveyId);

  // Extract only metadata-relevant fields
  return {
    id: fullSurvey.id,
    type: fullSurvey.type,
    status: fullSurvey.status,
    environmentId: fullSurvey.environmentId,
    name: fullSurvey.name,
    styling: fullSurvey.styling,
  };
};

/**
 * Combined response lookup for single use surveys
 * NO CACHING - responses change frequently during survey taking
 */
export const getResponseBySingleUseId = reactCache((surveyId: string, singleUseId: string) => async () => {
  try {
    const response = await prisma.response.findFirst({
      where: {
        surveyId,
        singleUseId,
      },
      select: {
        id: true,
        finished: true,
        // Include additional fields that might be useful
        createdAt: true,
        data: true,
      },
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Check if email verification response exists
 * NO CACHING - response data changes frequently and needs to be fresh
 */
export const isSurveyResponsePresent = reactCache((surveyId: string, email: string) => async () => {
  try {
    const response = await prisma.response.findFirst({
      where: {
        surveyId,
        data: {
          path: ["verifiedEmail"],
          equals: email,
        },
      },
      select: { id: true },
    });

    return !!response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Get existing contact response for contact surveys
 * NO CACHING - response data changes frequently and needs to be fresh
 */
export const getExistingContactResponse = reactCache((surveyId: string, contactId: string) => async () => {
  try {
    const response = await prisma.response.findFirst({
      where: {
        surveyId,
        contactId,
      },
      select: {
        id: true,
        finished: true,
      },
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Get organization billing information for survey limits
 * Cached separately with longer TTL
 */
export const getOrganizationBilling = reactCache((organizationId: string) =>
  withCache(
    async () => {
      try {
        const organization = await prisma.organization.findFirst({
          where: { id: organizationId },
          select: { billing: true },
        });

        if (!organization) {
          throw new ResourceNotFoundError("Organization", organizationId);
        }

        return organization.billing;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    {
      key: createCacheKey.organization.billing(organizationId),
      ttl: 60 * 60 * 24 * 1000, // 24 hours in milliseconds - billing info changes rarely
    }
  )()
);
