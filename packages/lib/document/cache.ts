import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  type?: string;
  referenceId?: string;
}

export const documentCache = {
  tag: {
    byId(id: string) {
      return `documents-${id}`;
    },
    byTypeAndReferenceId(type: string, id: string) {
      return `documents-${type}-${id}`;
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
