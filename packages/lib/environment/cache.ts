import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  productId?: string;
}

export const environmentCache = {
  tag: {
    byId(id: string) {
      return `environments-${id}`;
    },
    byProductId(productId: string) {
      return `products-${productId}-environments`;
    },
  },
  revalidate({ id, productId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (productId) {
      revalidateTag(this.tag.byProductId(productId));
    }
  },
};
