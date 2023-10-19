import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  surveyId?: string;
  personId?: string;
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
  },
  revalidate({ id, surveyId, personId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (surveyId) {
      revalidateTag(this.tag.bySurveyId(surveyId));
    }

    if (personId) {
      revalidateTag(this.tag.byPersonId(personId));
    }
  },
};
