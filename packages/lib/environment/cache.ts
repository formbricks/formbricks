import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  productId?: string;
  userId?: string;
}

export const environmentCache = {
  tag: {
    byId(id: string) {
      return `environments-${id}`;
    },
    byProductId(productId: string) {
      return `products-${productId}-environments`;
    },
    byUserId(userId: string) {
      return `users-${userId}-environments`;
    },
  },
  revalidate({ id, productId, userId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (productId) {
      revalidateTag(this.tag.byProductId(productId));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
  },
};
