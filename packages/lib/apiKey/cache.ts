import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  apiKey?: string;
}

export const apiKeyCache = {
  tag: {
    byId(id: string) {
      return `apiKeys-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-apiKeys`;
    },
    byApiKey(apiKey: string) {
      return `apiKeys-${apiKey}-apiKey`;
    },
  },
  revalidate({ id, environmentId, apiKey }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (apiKey) {
      revalidateTag(this.tag.byApiKey(apiKey));
    }
  },
};
