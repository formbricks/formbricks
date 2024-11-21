import { revalidateTag } from "next/cache";

interface RevalidateProps {
  tagId?: string;
  surveyId?: string;
  environmentId?: string;
}

export const tagOnSurveyCache = {
  tag: {
    bySurveyIdAndTagId(surveyId: string, tagId: string) {
      return `surveys-${surveyId}-tagOnSurveys-${tagId}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-tagOnSurveys`;
    },
  },
  revalidate({ tagId, surveyId, environmentId }: RevalidateProps): void {
    if (surveyId && tagId) {
      revalidateTag(this.tag.bySurveyIdAndTagId(surveyId, tagId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
