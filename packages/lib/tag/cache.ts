import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
}

export const tagCache = {
  tag: {
    byId(id: string) {
      return `tags-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-tags`;
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
