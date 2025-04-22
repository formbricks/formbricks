import { revalidateTag } from "next/cache";

interface RevalidateProps {
  userId?: string;
  organizationId?: string;
}

export const membershipCache = {
  tag: {
    byOrganizationId(organizationId: string) {
      return `organizations-${organizationId}-memberships`;
    },
    byUserId(userId: string) {
      return `users-${userId}-memberships`;
    },
  },
  revalidate({ organizationId, userId }: RevalidateProps): void {
    if (organizationId) {
      revalidateTag(this.tag.byOrganizationId(organizationId));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
  },
};
