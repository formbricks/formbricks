import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  key?: string;
}

export const contactAttributeKeyCache = {
  tag: {
    byId(id: string) {
      return `contactAttributeKey-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-contactAttributeKeys`;
    },
    byEnvironmentIdAndKey(environmentId: string, key: string) {
      return `contactAttributeKey-environment-${environmentId}-key-${key}`;
    },
  },
  revalidate: ({ id, environmentId, key }: RevalidateProps): void => {
    if (id) {
      revalidateTag(contactAttributeKeyCache.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(contactAttributeKeyCache.tag.byEnvironmentId(environmentId));
    }

    if (environmentId && key) {
      revalidateTag(contactAttributeKeyCache.tag.byEnvironmentIdAndKey(environmentId, key));
    }
  },
};
