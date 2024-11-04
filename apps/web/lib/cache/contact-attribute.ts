import { revalidateTag } from "next/cache";

interface RevalidateProps {
  environmentId?: string;
  contactId?: string;
  userId?: string;
  key?: string;
}

export const contactAttributeCache = {
  tag: {
    byContactId(contactId: string): string {
      return `contact-${contactId}-contactAttributes`;
    },
    byEnvironmentIdAndUserId(environmentId: string, userId: string): string {
      return `environments-${environmentId}-contact-userId-${userId}-contactAttributes`;
    },
    byKeyAndContactId(key: string, contactId: string): string {
      return `contact-${contactId}-contactAttribute-${key}`;
    },
  },
  revalidate({ contactId, environmentId, userId, key }: RevalidateProps): void {
    if (environmentId && userId) {
      revalidateTag(this.tag.byEnvironmentIdAndUserId(environmentId, userId));
    }
    if (contactId) {
      revalidateTag(this.tag.byContactId(contactId));
    }
    if (contactId && key) {
      revalidateTag(this.tag.byKeyAndContactId(key, contactId));
    }
  },
};
