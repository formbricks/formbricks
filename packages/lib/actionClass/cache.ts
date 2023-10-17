import { revalidateTag } from "next/cache";

interface RevalidateProps {
  environmentId?: string;
  name?: string;
  actionClassId?: string;
}

export const actionClassCache = {
  tag: {
    byNameAndEnvironmentId(name: string, environmentId: string): string {
      return `environments-${environmentId}-actionClass-${name}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-actionClasses`;
    },
    byActionClassId(actionClassId: string): string {
      return `actionClasses-${actionClassId}`;
    },
  },
  revalidate({ environmentId, name, actionClassId }: RevalidateProps): void {
    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (actionClassId) {
      revalidateTag(this.tag.byActionClassId(actionClassId));
    }

    if (name && environmentId) {
      revalidateTag(this.tag.byNameAndEnvironmentId(name, environmentId));
    }
  },
};
