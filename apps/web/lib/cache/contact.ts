import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  userId?: string;
}

export const contactCache = {
  tag: {
    byId(id: string): string {
      return `contacts-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-contacts`;
    },
    byEnvironmentIdAndUserId(environmentId: string, userId: string): string {
      return `environments-${environmentId}-contactByUserId-${userId}`;
    },
  },
  revalidate({ id, environmentId, userId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (environmentId && userId) {
      revalidateTag(this.tag.byEnvironmentIdAndUserId(environmentId, userId));
    }
  },
};
