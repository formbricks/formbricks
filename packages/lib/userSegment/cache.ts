import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  attributeClassName?: string;
}

export const userSegmentCache = {
  tag: {
    byId(id: string) {
      return `userSegment-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-userSegements`;
    },
    byAttributeClassName(attributeClassName: string): string {
      return `attribute-${attributeClassName}-userSegements`;
    },
  },
  revalidate({ id, environmentId, attributeClassName }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (attributeClassName) {
      revalidateTag(this.tag.byAttributeClassName(attributeClassName));
    }
  },
};
