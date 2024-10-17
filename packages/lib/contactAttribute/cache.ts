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
  },
  revalidate({ contactId }: RevalidateProps): void {
    if (contactId) {
      revalidateTag(this.tag.byContactId(contactId));
    }
  },
};
