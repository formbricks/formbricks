import { revalidateTag } from "next/cache";

interface RevalidateResponses {
  environmentId?: string;
  personId?: string;
  responseId?: string;
  singleUseId?: string;
  surveyId?: string;
}

export const responseCache = {
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
  revalidate({ environmentId, personId, responseId, singleUseId, surveyId }: RevalidateResponses): void {
    if (responseId) {
      revalidateTag(this.byResponseId(responseId));
    }

    if (personId) {
      revalidateTag(this.byPersonId(personId));
    }

    if (surveyId) {
      revalidateTag(this.bySurveyId(surveyId));
    }

    if (environmentId) {
      revalidateTag(this.byEnvironmentId(environmentId));
    }

    if (surveyId && singleUseId) {
      revalidateTag(this.bySingleUseId(surveyId, singleUseId));
    }
  },
};
