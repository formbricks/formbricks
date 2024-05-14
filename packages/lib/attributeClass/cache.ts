import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  name?: string;
  environmentId?: string;
  count?: boolean;
}

export const attributeClassCache = {
  tag: {
    byId(id: string) {
      return `attributeClass-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-attributeClasses`;
    },
    byEnvironmentIdAndName(environmentId: string, name: string) {
      return `environments-${environmentId}-name-${name}-attributeClasses`;
    },
    byCountAndEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-attributeClasses-count`;
    },
  },
  revalidate({ id, environmentId, name, count }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (environmentId && name) {
      revalidateTag(this.tag.byEnvironmentIdAndName(environmentId, name));
    }

    if (count && environmentId) {
      revalidateTag(this.tag.byCountAndEnvironmentId(environmentId));
    }
  },
};
