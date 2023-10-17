import { revalidateTag } from "next/cache";

interface RevalidateProps {
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
      return `people-${personId}-responses`;
    },
    bySingleUseId(surveyId: string, singleUseId: string) {
      return `surveys-${surveyId}-singleUse-${singleUseId}-responses`;
    },
    bySurveyId(surveyId: string) {
      return `surveys-${surveyId}-responses`;
    },
  },
  revalidate({ environmentId, personId, responseId, singleUseId, surveyId }: RevalidateProps): void {
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
