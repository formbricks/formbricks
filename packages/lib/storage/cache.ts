import { revalidateTag } from "next/cache";
import { TAccessType } from "@formbricks/types/storage";

interface RevalidateProps {
  environmentId?: string;
  accessType?: TAccessType;
}

export const storageCache = {
  tag: {
    byEnvironmentId(environmentId: string): string {
      return `storage-${environmentId}`;
    },
    byAccessType(accessTye: TAccessType): string {
      return `storage-${accessTye}`;
    },
  },
  revalidate({ environmentId, accessType }: RevalidateProps): void {
    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (accessType) {
      revalidateTag(this.tag.byAccessType(accessType));
    }
  },
};
