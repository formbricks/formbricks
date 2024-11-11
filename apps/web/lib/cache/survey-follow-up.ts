import { revalidateTag } from "next/cache";

interface RevalidateProps {
  surveyId?: string;
}

export const surveyFollowUpCache = {
  tag: {
    bySurveyId(surveyId: string): string {
      return `surveyFollowUp-bySurveyId-${surveyId}`;
    },
  },
  revalidate({ surveyId }: RevalidateProps): void {
    if (surveyId) {
      revalidateTag(this.tag.bySurveyId(surveyId));
    }
  },
};
