import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  email?: string;
  count?: boolean;
}

export const userCache = {
  tag: {
    byId(id: string) {
      return `users-${id}`;
    },
    byEmail(email: string) {
      return `users-${email}`;
    },
    byCount() {
      return "users-count";
    },
  },
  revalidate({ id, email, count }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (email) {
      revalidateTag(this.tag.byEmail(email));
    }
    if (count) {
      revalidateTag(this.tag.byCount());
    }
  },
};
