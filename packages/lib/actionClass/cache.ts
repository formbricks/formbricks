import { revalidateTag } from "next/cache";

interface RevalidateProps {
  environmentId?: string;
  name?: string;
  id?: string;
}

export const actionClassCache = {
  tag: {
    byNameAndEnvironmentId(name: string, environmentId: string): string {
      return `environments-${environmentId}-actionClass-${name}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-actionClasses`;
    },
    byId(id: string): string {
      return `actionClasses-${id}`;
    },
  },
  revalidate({ environmentId, name, id }: RevalidateProps): void {
    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (name && environmentId) {
      revalidateTag(this.tag.byNameAndEnvironmentId(name, environmentId));
    }
  },
};
