import { revalidateTag } from "next/cache";

interface RevalidateProps {
  environmentId?: string;
}

export const googleSheetCache = {
  tag: {
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-spreadsheets`;
    },
  },
  revalidate({ environmentId }: RevalidateProps): void {
    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }
  },
};
