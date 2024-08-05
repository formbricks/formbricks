import { revalidateTag } from "next/cache";

interface RevalidateProps {
  referenceId?: string;
}

export const embeddingCache = {
  tag: {
    byReferenceId(id: string) {
      return `environments-${id}`;
    },
  },
  revalidate({ referenceId }: RevalidateProps): void {
    if (referenceId) {
      revalidateTag(this.tag.byReferenceId(referenceId));
    }
  },
};
