import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";

/**
 * Checks if external URLs can be added or modified for the given organization.
 * Grandfathers existing external URLs (allows keeping them even on free plan).
 *
 * @param { string } organizationId  The ID of the organization to check.
 * @param { TSurvey } newSurvey  The new survey state.
 * @param { TSurvey | null } oldSurvey  The old survey state (or null for new surveys).
 * @returns { Promise<void> }  A promise that resolves if the permission is granted.
 * @throws { ResourceNotFoundError }  If the organization is not found.
 * @throws { OperationNotAllowedError }  If external URLs are not allowed and new/changed URLs are detected.
 */
export const checkExternalUrlsPermission = async (
  organizationId: string,
  newSurvey: TSurvey,
  oldSurvey: TSurvey | null
): Promise<void> => {
  const newQuestions = getElementsFromBlocks(newSurvey.blocks);
  const oldQuestions = oldSurvey?.blocks ? getElementsFromBlocks(oldSurvey.blocks) : [];

  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isExternalUrlsAllowed = await getExternalUrlsPermission(organizationBilling.plan);
  if (isExternalUrlsAllowed) {
    return;
  }

  // Check ending cards for new/changed button links
  for (const newEnding of newSurvey.endings) {
    const oldEnding = oldSurvey?.endings.find((e) => e.id === newEnding.id);

    if (newEnding.type === "endScreen" && newEnding.buttonLink) {
      if (!oldEnding || oldEnding.type !== "endScreen" || oldEnding.buttonLink !== newEnding.buttonLink) {
        throw new OperationNotAllowedError(
          "External URLs are not enabled for this organization. Upgrade to use external button links."
        );
      }
    }
  }

  // Check CTA questions for new/changed external button URLs
  for (const newQuestion of newQuestions) {
    const oldQuestion = oldQuestions.find((q) => q.id === newQuestion.id);

    if (newQuestion.type === "cta" && newQuestion.buttonExternal) {
      if (
        !oldQuestion ||
        oldQuestion.type !== "cta" ||
        !oldQuestion.buttonExternal ||
        oldQuestion.buttonUrl !== newQuestion.buttonUrl
      ) {
        throw new OperationNotAllowedError(
          "External URLs are not enabled for this organization. Upgrade to use external CTA buttons."
        );
      }
    }
  }
};
