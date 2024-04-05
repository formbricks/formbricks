import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  attributeClassName?: string;
}

export const segmentCache = {
  tag: {
    byId(id: string) {
      return `segment-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-segements`;
    },
    byAttributeClassName(attributeClassName: string): string {
      return `attribute-${attributeClassName}-segements`;
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
