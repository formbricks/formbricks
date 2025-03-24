import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  organizationId?: string;
  hashedKey?: string;
}

export const apiKeyNewCache = {
  tag: {
    byId(id: string) {
      return `apiKeys-${id}`;
    },
    byOrganizationId(organizationId: string) {
      return `organizations-${organizationId}-apiKeys`;
    },
    byHashedKey(hashedKey: string) {
      return `apiKeys-${hashedKey}-apiKey`;
    },
  },
  revalidate({ id, organizationId, hashedKey }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (organizationId) {
      revalidateTag(this.tag.byOrganizationId(organizationId));
    }

    if (hashedKey) {
      revalidateTag(this.tag.byHashedKey(hashedKey));
    }
  },
};
