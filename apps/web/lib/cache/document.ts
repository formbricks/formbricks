import { revalidateTag } from "next/cache";
import { TSurveyQuestionId } from "@formbricks/types/surveys/types";

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
    byResponseId(responseId: string) {
      return `responses-${responseId}-documents`;
    },
    byResponseIdQuestionId(responseId: string, questionId: TSurveyQuestionId) {
      return `responses-${responseId}-questions-${questionId}-documents`;
    },
    bySurveyId(surveyId: string) {
      return `surveys-${surveyId}-documents`;
    },
    bySurveyIdQuestionId(surveyId: string, questionId: TSurveyQuestionId) {
      return `surveys-${surveyId}-questions-${questionId}-documents`;
    },
    byInsightId(insightId: string) {
      return `insights-${insightId}-documents`;
    },
    byInsightIdSurveyIdQuestionId(insightId: string, surveyId: string, questionId: TSurveyQuestionId) {
      return `insights-${insightId}-surveys-${surveyId}-questions-${questionId}-documents`;
    },
  },
  revalidate({ id, environmentId, surveyId, responseId, questionId, insightId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }
    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
    if (responseId) {
      revalidateTag(this.tag.byResponseId(responseId));
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
    if (insightId && surveyId && questionId) {
      revalidateTag(this.tag.byInsightIdSurveyIdQuestionId(insightId, questionId));
    }
  },
};
