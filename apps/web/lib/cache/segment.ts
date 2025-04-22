import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  attributeKey?: string;
}

export const segmentCache = {
  tag: {
    byId(id: string) {
      return `segment-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-segements`;
    },
    byAttributeKey(attributeKey: string): string {
      return `attribute-${attributeKey}-segements`;
    },
  },
  revalidate({ id, environmentId, attributeKey }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (attributeKey) {
      revalidateTag(this.tag.byAttributeKey(attributeKey));
    }
  },
};
