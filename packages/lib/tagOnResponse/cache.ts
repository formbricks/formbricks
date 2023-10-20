import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  responseId?: string;
  functionName?: string;
}

export const tagOnResponseCache = {
  tag: {
    byResponseIdAndId(responseId: string, id: string) {
      return `responses-${responseId}-tagOnResponses-${id}`;
    },
    byFunctionName(functionName: string) {
      return `tagOnResponses-${functionName}`;
    },
  },
  revalidate({ id, responseId, functionName }: RevalidateProps): void {
    if (responseId && id) {
      revalidateTag(this.tag.byResponseIdAndId(responseId, id));
    }

    if (functionName) {
      revalidateTag(this.tag.byFunctionName(functionName));
    }
  },
};
