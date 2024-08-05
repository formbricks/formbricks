import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  type?: string;
  referenceId?: string;
}

export const embeddingCache = {
  tag: {
    byId(id: string) {
      return `embeddings-${id}`;
    },
    byTypeAndReferenceId(type: string, id: string) {
      return `embeddings-${type}-${id}`;
    },
  },
  revalidate({ id, type, referenceId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(referenceId));
    }
    if (type && referenceId) {
      revalidateTag(this.tag.byTypeAndReferenceId(type, referenceId));
    }
  },
};
