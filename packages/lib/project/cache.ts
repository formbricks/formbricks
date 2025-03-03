import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  organizationId?: string;
  environmentId?: string;
}

export const projectCache = {
  tag: {
    byId(id: string) {
      return `project-${id}`;
    },
    byUserId(userId: string) {
      return `users-${userId}-projects`;
    },
    byOrganizationId(organizationId: string) {
      return `organizations-${organizationId}-projects`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-projects`;
    },
  },
  revalidate({ id, userId, organizationId, environmentId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (organizationId) {
      revalidateTag(this.tag.byOrganizationId(organizationId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
  },
};
