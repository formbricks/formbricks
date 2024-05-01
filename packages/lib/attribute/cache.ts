import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  userId?: string;
  personId?: string;
  name: string;
}

export const attributeCache = {
  tag: {
    byEnvironmentIdAndUserId(environmentId: string, userId: string): string {
      return `environments-${environmentId}-personByUserId-${userId}-attributes`;
    },
    byPersonId(personId: string): string {
      return `person-${personId}-attributes`;
    },
    byNameAndPersonId(name: string, personId: string): string {
      return `person-${personId}-attribute-${name}`;
    },
  },
  revalidate({ environmentId, userId, personId, name }: RevalidateProps): void {
    if (environmentId && userId) {
      revalidateTag(this.tag.byEnvironmentIdAndUserId(environmentId, userId));
    }
    if (personId) {
      revalidateTag(this.tag.byPersonId(personId));
    }
    if (personId && name) {
      revalidateTag(this.tag.byNameAndPersonId(name, personId));
    }
  },
};
