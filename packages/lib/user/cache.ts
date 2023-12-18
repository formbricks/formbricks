import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  email?: string;
}

export const userCache = {
  tag: {
    byId(id: string) {
      return `users-${id}`;
    },
    byEmail(email: string) {
      return `users-${email}`;
    },
  },
  revalidate({ id, email }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (email) {
      revalidateTag(this.tag.byEmail(email));
    }
  },
};
