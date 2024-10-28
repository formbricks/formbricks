import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  contactId?: string;
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
  revalidate({ contactId }: RevalidateProps): void {
    if (contactId) {
      revalidateTag(this.tag.byContactId(contactId));
    }
  },
};
