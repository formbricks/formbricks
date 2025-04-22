import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  type?: string;
}

export const integrationCache = {
  tag: {
    byId(id: string) {
      return `integrations-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-integrations`;
    },
    byEnvironmentIdAndType(environmentId: string, type: string) {
      return `environments-${environmentId}-type-${type}-integrations`;
    },
  },
  revalidate({ id, environmentId, type }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (environmentId && type) {
      revalidateTag(this.tag.byEnvironmentIdAndType(environmentId, type));
    }
  },
};
