import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { assertSegmentSurveyFiltersVisible } from "@/modules/ee/contacts/segments/lib/helper";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

export const ADVANCED_TARGETING_NOT_ALLOWED_MESSAGE =
  "Advanced targeting is not allowed for this organization";

/**
 * The licence gate every segment read and write shares: the organization must exist and have Contacts.
 * Throws `ResourceNotFoundError` for an unknown organization, `OperationNotAllowedError` without Contacts.
 */
export const checkAdvancedTargetingPermission = async (organizationId: string): Promise<void> => {
  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  if (!(await getIsContactsEnabled(organizationId))) {
    throw new OperationNotAllowedError(ADVANCED_TARGETING_NOT_ALLOWED_MESSAGE);
  }
};

/**
 * ENG-6870: attaching or copying a segment onto a survey targets that survey at whoever the segment's
 * survey-interaction filters match, and the survey's responses then show who they are. So the caller must
 * see every survey those filters read, as if they had written them. Throws `InvalidInputError` when a filter
 * reads one they can't see, and `ResourceNotFoundError` for a segment that is gone.
 */
export const assertCanTargetWithSegment = async (
  userId: string,
  organizationId: string,
  segmentId: string
): Promise<void> => {
  const segment = await getSegment(segmentId);
  await assertSegmentSurveyFiltersVisible(
    segment.filters,
    segment.workspaceId,
    await resolveSurveyActorContext({ type: "user", id: userId }, organizationId),
    segment.id
  );
};
