import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
}

export const insightCache = {
  tag: {
    byId(id: string) {
      return `documentGroups-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-documentGroups`;
    },
  },
  revalidate: ({ id, environmentId }: RevalidateProps): void => {
    if (id) {
      revalidateTag(insightCache.tag.byId(id));
    }
    if (environmentId) {
      revalidateTag(insightCache.tag.byEnvironmentId(environmentId));
    }
  },
};
