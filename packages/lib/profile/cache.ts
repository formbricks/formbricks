import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  email?: string;
  userId?: string;
}

export const profileCache = {
  tag: {
    byId(id: string) {
      return `profiles-${id}`;
    },
    byUserId(userId: string) {
      return `profiles-${userId}`;
    },
    byEmail(email: string) {
      return `profiles-${email}`;
    },
  },
  revalidate({ id, email, userId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (email) {
      revalidateTag(this.tag.byEmail(email));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
  },
};
