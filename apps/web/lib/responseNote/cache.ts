import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  responseId?: string;
}

export const responseNoteCache = {
  tag: {
    byId(id: string) {
      return `responseNotes-${id}`;
    },
    byResponseId(responseId: string) {
      return `responses-${responseId}-responseNote`;
    },
  },
  revalidate({ id, responseId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (responseId) {
      revalidateTag(this.tag.byResponseId(responseId));
    }
  },
};
