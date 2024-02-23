import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  attributeClassId?: string;
  actionClassId?: string;
  environmentId?: string;
  segmentId?: string;
}

export const surveyCache = {
  tag: {
    byId(id: string) {
      return `surveys-${id}`;
    },
    byEnvironmentId(environmentId: string): string {
      return `environments-${environmentId}-surveys`;
    },
    byAttributeClassId(attributeClassId: string) {
      return `attributeFilters-${attributeClassId}-surveys`;
    },
    byActionClassId(actionClassId: string) {
      return `actionClasses-${actionClassId}-surveys`;
    },
    bySegmentId(segmentId: string) {
      return `segments-${segmentId}-surveys`;
    },
  },
  revalidate({ id, attributeClassId, actionClassId, environmentId, segmentId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (attributeClassId) {
      revalidateTag(this.tag.byAttributeClassId(attributeClassId));
    }

    if (actionClassId) {
      revalidateTag(this.tag.byActionClassId(actionClassId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (segmentId) {
      revalidateTag(this.tag.bySegmentId(segmentId));
    }
  },
};
