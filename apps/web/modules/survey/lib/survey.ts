import { Organization, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/billing/lib/organization-billing";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";

export const selectSurvey = {
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
  blocks: true,
  endings: true,
  hiddenFields: true,
  variables: true,
  displayOption: true,
  recontactDays: true,
  displayLimit: true,
  autoClose: true,
  delay: true,
  displayPercentage: true,
  autoComplete: true,
  isVerifyEmailEnabled: true,
  isSingleResponsePerEmailEnabled: true,
  isCaptureIpEnabled: true,
  redirectUrl: true,
  projectOverwrites: true,
  styling: true,
  surveyClosedMessage: true,
  singleUse: true,
  pin: true,
  showLanguageSwitch: true,
  recaptcha: true,
  isBackButtonHidden: true,
  metadata: true,
  slug: true,
  customHeadScripts: true,
  customHeadScriptsMode: true,
  languages: {
    select: {
      default: true,
      enabled: true,
      language: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          code: true,
          projectId: true,
          alias: true,
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
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      environmentId: true,
      title: true,
      description: true,
      isPrivate: true,
      filters: true,
      surveys: {
        select: {
          id: true,
        },
      },
    },
  },
  followUps: true,
} satisfies Prisma.SurveySelect;

export const getOrganizationBilling = reactCache(
  async (organizationId: string): Promise<Organization["billing"]> => {
    const billing = await getOrganizationBillingWithReadThroughSync(organizationId);
    if (!billing) throw new ResourceNotFoundError("Organization", organizationId);
    return billing as Organization["billing"];
  }
);

export const getSurvey = reactCache(async (surveyId: string): Promise<TSurvey> => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: selectSurvey,
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
});
