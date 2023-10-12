import { revalidateTag } from "next/cache";

interface RevalidateResponses {
  environmentId?: string;
  personId?: string;
  responseId?: string;
  singleUseId?: string;
  surveyId?: string;
}

export const responseCache = {
  tag: {
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-responses`;
    },
    byResponseId(responseId: string) {
      return `responses-${responseId}`;
    },
    byPersonId(personId: string) {
      return `person-${personId}-responses`;
    },
    bySingleUseId(surveyId: string, singleUseId: string) {
      return `survey-${surveyId}-singleuse-${singleUseId}-responses`;
    },
    bySurveyId(surveyId: string) {
      return `surveys-${surveyId}-responses`;
    },
  },
  revalidate({ environmentId, personId, responseId, singleUseId, surveyId }: RevalidateResponses): void {
    if (responseId) {
      revalidateTag(this.tag.byResponseId(responseId));
    }

    if (personId) {
      revalidateTag(this.tag.byPersonId(personId));
    }

    if (surveyId) {
      revalidateTag(this.tag.bySurveyId(surveyId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (surveyId && singleUseId) {
      revalidateTag(this.tag.bySingleUseId(surveyId, singleUseId));
    }
  },
};
