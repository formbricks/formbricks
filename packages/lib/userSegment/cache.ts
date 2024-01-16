import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;

  environmentId?: string;
}

export const userSegmentCache = {
  tag: {
    byId(id: string) {
      return `userSegment-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-userSegements`;
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
