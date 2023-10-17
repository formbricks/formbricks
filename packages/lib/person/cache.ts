import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  userId?: string;
}

export const personCache = {
  tag: {
    byId(id: string): string {
      return `people-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-people`;
    },
    byUserId(userId: string): string {
      return `users-${userId}-people`;
    },
    byUserIdAndEnvironmentId(userId: string, environmentId: string): string {
      return `users-${userId}-environments-${environmentId}-people`;
    },
  },
  revalidate({ id, environmentId, userId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }

    if (userId && environmentId) {
      revalidateTag(this.tag.byUserIdAndEnvironmentId(userId, environmentId));
    }
  },
};
