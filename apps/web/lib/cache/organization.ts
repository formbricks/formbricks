import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  environmentId?: string;
  count?: boolean;
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
    byCount() {
      return "organizations-count";
    },
  },
  revalidate({ id, userId, environmentId, count }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (count) {
      revalidateTag(this.tag.byCount());
    }
  },
};
