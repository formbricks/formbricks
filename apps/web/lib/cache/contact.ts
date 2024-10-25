import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
}

export const contactCache = {
  tag: {
    byId(id: string): string {
      return `contacts-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-contacts`;
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
