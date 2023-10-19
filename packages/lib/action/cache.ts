import { revalidateTag } from "next/cache";

interface RevalidateProps {
  environmentId?: string;
}

export const actionCache = {
  tag: {
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-actions`;
    },
  },
  revalidate({ environmentId }: RevalidateProps): void {
    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
