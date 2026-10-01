import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { type TSurveyQuota } from "@formbricks/types/quota";
import { type TSurvey } from "@formbricks/types/surveys/types";
import {
  findHiddenFieldUsedInLogic,
  findVariableUsedInLogic,
  isUsedInQuota,
  isUsedInRecall,
} from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/**
 * Whether anything in the survey still points at a field, and what.
 *
 * Dropping a field that logic, a recall token, a quota or a follow-up still references leaves a
 * reference to nothing — a condition that can never match, a `#recall:…#` token rendered as raw
 * text — so the card refuses the removal and says where to go instead.
 *
 * **One function for both sources**, which is the whole reason it exists: the Variables card and the
 * Hidden Fields card each carried their own copy of this cascade, in the same order, differing only
 * in which `findUsedInLogic` they called and which of two parallel sets of strings they raised. The
 * merged card cannot afford either copy, and neither could be unit-tested where it sat.
 *
 * Returns a **descriptor rather than a sentence**: `t()` calls have to be statically resolvable for
 * the key scanner, so the copy stays in the component and only the branch is decided here.
 */
export type TEmbeddedFieldBlocker =
  | { reason: "logic"; elementIndex: number }
  | { reason: "recallWelcome" }
  | { reason: "recallEnding" }
  | { reason: "recall"; elementIndex: number }
  | { reason: "quota"; quotaName: string }
  | { reason: "followUp" };

/**
 * A field is addressed by its **storage key** everywhere a reference can exist — recall tokens,
 * logic operands, quota criteria, follow-up targets — for a computed field as much as an ingested
 * one, so that is what every lookup below is given rather than the display name.
 */
export const findEmbeddedFieldRemovalBlocker = (
  survey: TSurvey,
  quotas: TSurveyQuota[],
  { field, link }: TLinkedEmbeddedField
): TEmbeddedFieldBlocker | null => {
  const isComputed = field.source === "computed";
  const storageKey = link.storageKey;

  const logicElementIndex = isComputed
    ? findVariableUsedInLogic(survey, storageKey)
    : findHiddenFieldUsedInLogic(survey, storageKey);
  if (logicElementIndex !== -1) return { reason: "logic", elementIndex: logicElementIndex };

  // `isUsedInRecall` answers with three sentinels and an index: -2 is the welcome card, the element
  // count is the ending card, -1 is "nowhere", and anything else is that element's position.
  const recallElementIndex = isUsedInRecall(survey, storageKey);
  if (recallElementIndex === -2) return { reason: "recallWelcome" };
  if (recallElementIndex === getElementsFromBlocks(survey.blocks).length) return { reason: "recallEnding" };
  if (recallElementIndex !== -1) return { reason: "recall", elementIndex: recallElementIndex };

  const quota = quotas.find((candidate) =>
    isUsedInQuota(candidate, isComputed ? { variableId: storageKey } : { hiddenFieldId: storageKey })
  );
  if (quota) return { reason: "quota", quotaName: quota.name };

  // Only ingested fields can be a follow-up's recipient — the `to` of an email action is a field the
  // survey was *given* an address in, never one it calculated.
  const isUsedInFollowUp = survey.followUps
    .filter((followUp) => !followUp.deleted)
    .some((followUp) => followUp.action.properties.to === storageKey);
  if (isUsedInFollowUp) return { reason: "followUp" };

  return null;
};
