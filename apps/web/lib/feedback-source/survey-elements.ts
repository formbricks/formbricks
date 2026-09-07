import "server-only";
import { THubFieldType, getHubFieldTypeFromElementType } from "@formbricks/types/feedback-source";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { getElementsFromBlocks } from "@/lib/survey/utils";

export type TSurveyElementIndex = {
  /** Every element id in the survey, mappable or not. */
  elementIds: Set<string>;
  /** Only the elements that can be represented as a Hub field, keyed by element id, in survey order. */
  supportedHubFieldTypes: Map<string, THubFieldType>;
};

/**
 * Index a survey's elements once for the two callers that must agree on what "mappable" means:
 * resolving an operator's selection into mapping rows, and reconciling stored rows against a survey
 * that has since changed.
 *
 * Both sets are returned because the difference between them carries meaning. An element id present
 * in `elementIds` but absent from `supportedHubFieldTypes` was retyped to one of the
 * UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES (contactInfo, address, cal, cta, fileUpload, consent) —
 * which is a very different situation from an id that is missing entirely, because the element still
 * resolves on the publish path and would keep exporting answers.
 *
 * `getHubFieldTypeFromElementType` returns `THubFieldType | undefined` — it is a bare index access
 * into a Record<string, THubFieldType>, so the unsupported types yield undefined. It used to be
 * declared as returning `THubFieldType` and this call site cast the truth back in; the declaration
 * now says what it does, so the cast is gone.
 */
export const indexSurveyElements = (blocks: TSurveyBlock[]): TSurveyElementIndex => {
  const elementIds = new Set<string>();
  const supportedHubFieldTypes = new Map<string, THubFieldType>();

  for (const element of getElementsFromBlocks(blocks)) {
    elementIds.add(element.id);

    const hubFieldType = getHubFieldTypeFromElementType(element.type);
    if (hubFieldType) {
      supportedHubFieldTypes.set(element.id, hubFieldType);
    }
  }

  return { elementIds, supportedHubFieldTypes };
};
