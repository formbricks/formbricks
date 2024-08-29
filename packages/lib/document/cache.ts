import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string | null;
  surveyId?: string | null;
  responseId?: string | null;
  questionId?: string | null;
  insightId?: string | null;
}

export const documentCache = {
  tag: {
    byId(id: string) {
      return `documents-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-documents`;
    },
    byResponseIdQuestionId(responseId: string, questionId: string) {
      return `responses-${responseId}-questions-${questionId}-documents`;
    },
    bySurveyId(surveyId: string) {
      return `surveys-${surveyId}-documents`;
    },
    bySurveyIdQuestionId(surveyId: string, questionId: string) {
      return `surveys-${surveyId}-questions-${questionId}-documents`;
    },
    byInsightId(insightId: string) {
      return `insights-${insightId}-documents`;
    },
  },
  revalidate({ id, environmentId, surveyId, responseId, questionId, insightId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }
    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
    if (surveyId) {
      revalidateTag(this.tag.bySurveyId(surveyId));
    }
    if (responseId && questionId) {
      revalidateTag(this.tag.byResponseIdQuestionId(responseId, questionId));
    }
    if (surveyId && questionId) {
      revalidateTag(this.tag.bySurveyIdQuestionId(surveyId, questionId));
    }
    if (insightId) {
      revalidateTag(this.tag.byInsightId(insightId));
    }
  },
};
