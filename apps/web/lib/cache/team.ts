import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  productId?: string;
  organizationId?: string;
}

export const teamCache = {
  tag: {
    byId(id: string) {
      return `team-${id}`;
    },
    byProductId(productId: string) {
      return `product-teams-${productId}`;
    },
    byUserId(userId: string) {
      return `user-${userId}-teams`;
    },
    byOrganizationId(organizationId: string) {
      return `organization-${organizationId}-teams`;
    },
  },
  revalidate({ id, productId, userId, organizationId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }
    if (productId) {
      revalidateTag(this.tag.byProductId(productId));
    }
    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
    if (organizationId) {
      revalidateTag(this.tag.byOrganizationId(organizationId));
    }
  },
};
