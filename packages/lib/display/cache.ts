import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  surveyId?: string;
  contactId?: string | null;
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
    byContactId(contactId: string) {
      return `contacts-${contactId}-displays`;
    },
    byEnvironmentIdAndUserId(environmentId: string, userId: string) {
      return `environments-${environmentId}-users-${userId}-displays`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-displays`;
    },
  },
  revalidate({ id, surveyId, contactId, environmentId, userId }: RevalidateProps): void {
    if (environmentId && userId) {
      revalidateTag(this.tag.byEnvironmentIdAndUserId(environmentId, userId));
    }

    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (surveyId) {
      revalidateTag(this.tag.bySurveyId(surveyId));
    }

    if (contactId) {
      revalidateTag(this.tag.byContactId(contactId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
