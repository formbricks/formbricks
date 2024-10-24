import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  organizationId?: string;
}

export const teamCache = {
  tag: {
    byId(id: string) {
      return `team-${id}`;
    },
    byUserId(userId: string) {
      return `user-${userId}-teams`;
    },
    byOrganizationId(organizationId: string) {
      return `organization-${organizationId}-teams`;
    },
  },
  revalidate({ id, userId, organizationId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }
    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
    if (organizationId) {
      revalidateTag(this.tag.byOrganizationId(organizationId));
    }
  },
};
