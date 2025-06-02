import { invalidateCache } from "@/modules/cache/lib/withCache";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";

// BYPASSED - see below

interface RevalidateProps {
  id?: string;
  attributeClassId?: string;
  actionClassId?: string;
  environmentId?: string;
  segmentId?: string;
  resultShareKey?: string;
}

export const surveyCache = {
  // Legacy tag system - kept for existing cache() functions that still use it
  tag: {
    byId: (id: string) => `surveys-${id}`,
    byEnvironmentId: (environmentId: string) => `environments-${environmentId}-surveys`,
    byActionClassId: (actionClassId: string) => `actionClasses-${actionClassId}-surveys`,
    byAttributeClassId: (attributeClassId: string) => `attributeFilters-${attributeClassId}-surveys`,
    bySegmentId: (segmentId: string) => `segments-${segmentId}-surveys`,
    byResultShareKey: (resultShareKey: string) => `surveys-resultShare-${resultShareKey}`,
  },

  /**
   * Main revalidation function - handles both legacy and new cache systems
   */
  revalidate({
    id,
    attributeClassId,
    actionClassId,
    environmentId,
    segmentId,
    resultShareKey,
  }: RevalidateProps): void {
    // 1. Legacy NextJS tag-based revalidation (BYPASSED - see revalidateTag mock above)
    if (id) revalidateTag(this.tag.byId(id));
    if (attributeClassId) revalidateTag(this.tag.byAttributeClassId(attributeClassId));
    if (actionClassId) revalidateTag(this.tag.byActionClassId(actionClassId));
    if (environmentId) revalidateTag(this.tag.byEnvironmentId(environmentId));
    if (segmentId) revalidateTag(this.tag.bySegmentId(segmentId));
    if (resultShareKey) revalidateTag(this.tag.byResultShareKey(resultShareKey));

    // 2. New Redis cache invalidation + NextJS path revalidation
    if (id) {
      // Invalidate optimized survey data cache
      invalidateCache(`fb:survey:${id}:full`).catch((error) => {
        console.warn(`Failed to invalidate survey cache for ${id}:`, error);
      });

      // Revalidate survey(link p)ge
      revalidatePath(`/s/${id}`);
    }
  },
};
