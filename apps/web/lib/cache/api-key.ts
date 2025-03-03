import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  hashedKey?: string;
}

export const apiKeyCache = {
  tag: {
    byId(id: string) {
      return `apiKeys-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-apiKeys`;
    },
    byHashedKey(hashedKey: string) {
      return `apiKeys-${hashedKey}-apiKey`;
    },
  },
  revalidate({ id, environmentId, hashedKey }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (hashedKey) {
      revalidateTag(this.tag.byHashedKey(hashedKey));
    }
  },
};
