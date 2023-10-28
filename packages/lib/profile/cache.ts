import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  email?: string;
}

export const profileCache = {
  tag: {
    byId(id: string) {
      return `profiles-${id}`;
    },
    byEmail(email: string) {
      return `profiles-${email}`;
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
