import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  responseId?: string;
  questionId?: string;
}

export const documentCache = {
  tag: {
    byId(id: string) {
      return `documents-${id}`;
    },
    byResponseIdQuestionId(responseId: string, questionId: string) {
      return `responses-${responseId}-questions-${questionId}-documents`;
    },
  },
  revalidate({ id, responseId, questionId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }
    if (responseId && questionId) {
      revalidateTag(this.tag.byResponseIdQuestionId(responseId, questionId));
    }
  },
};
