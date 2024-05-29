import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  environmentId?: string;
}

export const organizationCache = {
  tag: {
    byId(id: string) {
      return `organizations-${id}`;
    },
    byUserId(userId: string) {
      return `users-${userId}-organizations`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-organizations`;
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
