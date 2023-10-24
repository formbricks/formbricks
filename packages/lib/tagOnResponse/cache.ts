import { revalidateTag } from "next/cache";

interface RevalidateProps {
  tagId?: string;
  responseId?: string;
  functionName?: string;
}

export const tagOnResponseCache = {
  tag: {
    byResponseIdAndTagId(responseId: string, tagId: string) {
      return `responses-${responseId}-tagOnResponses-${tagId}`;
    },
    byFunctionName(functionName: string) {
      return `tagOnResponses-${functionName}`;
    },
  },
  revalidate({ tagId, responseId, functionName }: RevalidateProps): void {
    if (responseId && tagId) {
      revalidateTag(this.tag.byResponseIdAndTagId(responseId, tagId));
    }

    if (functionName) {
      revalidateTag(this.tag.byFunctionName(functionName));
    }
  },
};
