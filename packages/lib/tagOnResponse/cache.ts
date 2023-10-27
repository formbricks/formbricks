import { revalidateTag } from "next/cache";

interface RevalidateProps {
  tagId?: string;
  responseId?: string;
  environmentId?: string;
}

export const tagOnResponseCache = {
  tag: {
    byResponseIdAndTagId(responseId: string, tagId: string) {
      return `responses-${responseId}-tagOnResponses-${tagId}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-tagOnResponses`;
    },
  },
  revalidate({ tagId, responseId, environmentId }: RevalidateProps): void {
    if (responseId && tagId) {
      revalidateTag(this.tag.byResponseIdAndTagId(responseId, tagId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
