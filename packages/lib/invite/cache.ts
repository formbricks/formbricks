import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  organizationId?: string;
}

export const inviteCache = {
  tag: {
    byId(id: string) {
      return `invites-${id}`;
    },
    byOrganizationId(organizationId: string) {
      return `organizations-${organizationId}-invites`;
    },
  },
  revalidate({ id, organizationId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (organizationId) {
      revalidateTag(this.tag.byOrganizationId(organizationId));
    }
  },
};
