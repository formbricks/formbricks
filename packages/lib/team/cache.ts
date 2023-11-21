import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  environmentId?: string;
}

export const teamCache = {
  tag: {
    byId(id: string) {
      return `teams-${id}`;
    },
    byUserId(userId: string) {
      return `users-${userId}-teams`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-teams`;
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
