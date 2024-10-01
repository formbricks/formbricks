import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  personId?: string;
  userId?: string;
  singleUseId?: string;
  surveyId?: string;
}

export const responseCache = {
  tag: {
    byId(responseId: string) {
      return `responses-${responseId}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-responses`;
    },
    byPersonId(personId: string) {
      return `people-${personId}-responses`;
    },
    byEnvironmentIdAndUserId(environmentId: string, userId: string) {
      return `environments-${environmentId}-users-${userId}-responses`;
    },
    bySingleUseId(surveyId: string, singleUseId: string) {
      return `surveys-${surveyId}-singleUse-${singleUseId}-responses`;
    },
    bySurveyId(surveyId: string) {
      return `surveys-${surveyId}-responses`;
    },
  },
  revalidate({ environmentId, personId, id, singleUseId, surveyId, userId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
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

    if (environmentId && userId) {
      revalidateTag(this.tag.byEnvironmentIdAndUserId(environmentId, userId));
    }

    if (surveyId && singleUseId) {
      revalidateTag(this.tag.bySingleUseId(surveyId, singleUseId));
    }
  },
};
