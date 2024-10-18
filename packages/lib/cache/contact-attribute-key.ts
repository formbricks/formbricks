import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
}

export const contactAttributeKeyCache = {
  tag: {
    byId(id: string) {
      return `contactAttributeKey-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-contactAttributeKeys`;
    },
  },
  revalidate({ id, environmentId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
