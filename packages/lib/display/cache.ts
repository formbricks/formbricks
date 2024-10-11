import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  surveyId?: string;
  personId?: string | null;
  userId?: string;
  environmentId?: string;
}

export const displayCache = {
  tag: {
    byId(id: string) {
      return `displays-${id}`;
    },
    bySurveyId(surveyId: string) {
      return `surveys-${surveyId}-displays`;
    },
    byPersonId(personId: string) {
      return `people-${personId}-displays`;
    },
    byEnvironmentIdAndUserId(environmentId: string, userId: string) {
      return `environments-${environmentId}-users-${userId}-displays`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-displays`;
    },
  },
  revalidate({ id, surveyId, personId, environmentId, userId }: RevalidateProps): void {
    if (environmentId && userId) {
      revalidateTag(this.tag.byEnvironmentIdAndUserId(environmentId, userId));
    }

    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (surveyId) {
      revalidateTag(this.tag.bySurveyId(surveyId));
    }

    if (personId) {
      revalidateTag(this.tag.byPersonId(personId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
