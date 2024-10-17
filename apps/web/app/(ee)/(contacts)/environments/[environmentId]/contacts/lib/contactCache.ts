import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  environmentId?: string;
}

export const contactCache = {
  tag: {
    byId(id: string): string {
      return `contact-${id}`;
    },
    byUserId(userId: string): string {
      return `contact-${userId}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environment-${environmentId}-contact`;
    },
  },
  revalidate({ id, userId, environmentId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
