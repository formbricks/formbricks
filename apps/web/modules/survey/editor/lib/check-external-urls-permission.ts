import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { isDefaultEndingCardButtonLink } from "@/lib/survey/default-ending-card";
import { addsRichTextLink } from "@/lib/survey/rich-text-links";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";

/** Whether the new survey adds or changes an ending card's external button link. */
const addsExternalEndingLink = (newSurvey: TSurvey, oldSurvey: TSurvey | null): boolean =>
  newSurvey.endings.some((newEnding) => {
    if (
      newEnding.type !== "endScreen" ||
      !newEnding.buttonLink ||
      isDefaultEndingCardButtonLink(newEnding.buttonLink)
    ) {
      return false;
    }
    const oldEnding = oldSurvey?.endings.find((e) => e.id === newEnding.id);
    return !oldEnding || oldEnding.type !== "endScreen" || oldEnding.buttonLink !== newEnding.buttonLink;
  });

/** Whether a CTA question adds or changes its external button URL. */
const addsExternalCtaUrl = (
  newQuestions: ReturnType<typeof getElementsFromBlocks>,
  oldQuestions: ReturnType<typeof getElementsFromBlocks>
): boolean =>
  newQuestions.some((newQuestion) => {
    if (newQuestion.type !== "cta" || !newQuestion.buttonExternal) return false;
    const oldQuestion = oldQuestions.find((q) => q.id === newQuestion.id);
    return (
      !oldQuestion ||
      oldQuestion.type !== "cta" ||
      !oldQuestion.buttonExternal ||
      oldQuestion.buttonUrl !== newQuestion.buttonUrl
    );
  });

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

  const isExternalUrlsAllowed = await getExternalUrlsPermission(organizationId);
  if (isExternalUrlsAllowed) {
    return;
  }

  // Check ending cards for new/changed button links
  if (addsExternalEndingLink(newSurvey, oldSurvey)) {
    throw new OperationNotAllowedError(
      "External URLs are not enabled for this organization. Upgrade to use external button links."
    );
  }

  // Check CTA questions for new/changed external button URLs
  if (addsExternalCtaUrl(newQuestions, oldQuestions)) {
    throw new OperationNotAllowedError(
      "External URLs are not enabled for this organization. Upgrade to use external CTA buttons."
    );
  }

  // Check rich text (headlines, subheaders, welcome and ending cards) for new links (ENG-3891)
  if (addsRichTextLink(newSurvey, oldSurvey)) {
    throw new OperationNotAllowedError(
      "External URLs are not enabled for this organization. Upgrade to use links in survey text."
    );
  }
};
