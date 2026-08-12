import "server-only";
import { THubFieldType, getHubFieldTypeFromElementType } from "@formbricks/types/feedback-source";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { getElementsFromBlocks } from "@/lib/survey/utils";

/**
 * Every element in `blocks` that the product can represent as a Hub field, keyed by element id and in
 * survey order.
 *
 * Elements whose type has no Hub field are omitted — the
 * UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES (contactInfo, address, cal, cta, fileUpload, consent).
 * `getHubFieldTypeFromElementType` is declared as returning THubFieldType but is really a bare index
 * access into a Record<string, THubFieldType>, so it yields undefined for those; this is the one place
 * that cast lives.
 *
 * Shared by the two callers that must agree on what "mappable" means: resolving an operator's
 * selection into mapping rows, and reconciling stored rows against a survey that has since changed.
 */
export const getSupportedHubFieldTypes = (blocks: TSurveyBlock[]): Map<string, THubFieldType> => {
  const supported = new Map<string, THubFieldType>();

  for (const element of getElementsFromBlocks(blocks)) {
    const hubFieldType = getHubFieldTypeFromElementType(element.type) as THubFieldType | undefined;
    if (hubFieldType) {
      supported.set(element.id, hubFieldType);
    }
  }

  return supported;
};
