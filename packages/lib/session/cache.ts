import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  personId?: string;
}

export const sessionCache = {
  tag: {
    byId(id: string) {
      return `sessions-${id}`;
    },
    byPersonId(personId: string) {
      return `people-${personId}-sessions`;
    },
  },
  revalidate({ id, personId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (personId) {
      revalidateTag(this.tag.byPersonId(personId));
    }
  },
};
